// ts-server/src/controllers/coursePurchase.controller.ts
// Purchase controller with TypeScript

import { Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient, pgPool, TABLE_NAMES, query } from '../config/databaseClients.js';
import {
  Purchase,
  Course,
  CreatePurchaseRequest,
  VerifyPaymentRequest,
  ApiResponse,
} from '../types/index.js';

// Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_SECRET_KEY!,
});

// Create Razorpay order and pending purchase record
export const createRazorpayOrder = async (
  req: Request<{}, {}, CreatePurchaseRequest>,
  res: Response<ApiResponse<{ orderId: string; amount: number; courseId: string }>>
): Promise<void> => {
  const userId = req.id;
  const { courseId, amount, currency = 'INR' } = req.body;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "User not authenticated",
    });
    return;
  }

  let pgClient;

  try {
    pgClient = await pgPool.connect();

    // Check existing purchase
    const existingPurchaseQuery = `
      SELECT purchase_id, status FROM purchases 
      WHERE user_id = $1 AND course_id = $2
    `;
    const existingResult = await pgClient.query<Purchase>(existingPurchaseQuery, [
      userId,
      courseId,
    ]);

    if (existingResult.rows.length > 0) {
      const existingPurchase = existingResult.rows[0];
      if (existingPurchase.status === "completed") {
        res.status(400).json({
          success: false,
          message: "You have already purchased this course!",
        });
        return;
      }
    }

    // Fetch course details from DynamoDB
    const { Item: course } = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLE_NAMES.LMS,
        Key: { PK: `COURSE#${courseId}`, SK: "METADATA" },
      })
    );

    if (!course) {
      res.status(404).json({
        success: false,
        message: "Course not found!",
      });
      return;
    }

    const courseData = course as Course;
    const coursePriceNumber = parseFloat(courseData.coursePrice.toString()) || 0;

    // Use provided amount or course price
    const finalAmount = amount || coursePriceNumber;

    // Create Razorpay order
    const options = {
      amount: Math.round(finalAmount * 100), // Amount in paise
      currency: currency.toUpperCase(),
      receipt: `receipt_${Date.now()}_${userId.slice(-8)}`,
    };

    const order = await razorpay.orders.create(options);
    if (!order) {
      res.status(500).json({
        success: false,
        message: "Error creating Razorpay order",
      });
      return;
    }

    await pgClient.query("BEGIN");

    try {
      if (existingResult.rows.length > 0) {
        // Update existing purchase
        const updateQuery = `
          UPDATE purchases SET
            amount = $1,
            currency = $2,
            status = 'pending',
            order_id = $3,
            payment_id = NULL,
            payment_signature = NULL,
            updated_at = CURRENT_TIMESTAMP,
            course_title = $4,
            course_thumbnail = $5
          WHERE user_id = $6 AND course_id = $7
          RETURNING purchase_id
        `;
        
        await pgClient.query(updateQuery, [
          finalAmount,
          currency,
          order.id,
          courseData.courseTitle,
          courseData.courseThumbnail || null,
          userId,
          courseId,
        ]);
      } else {
        // Create new purchase
        const purchaseId = uuidv4();
        const insertQuery = `
          INSERT INTO purchases (
            purchase_id, user_id, course_id, course_title, course_thumbnail,
            amount, currency, status, order_id, payment_method, content_type
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;
        
        await pgClient.query(insertQuery, [
          purchaseId,
          userId,
          courseId,
          courseData.courseTitle,
          courseData.courseThumbnail || null,
          finalAmount,
          currency,
          'pending',
          order.id,
          'razorpay',
          'video_course',
        ]);
      }

      await pgClient.query("COMMIT");

      res.status(200).json({
        success: true,
        message: "Order created successfully",
        data: {
          orderId: order.id,
          amount: finalAmount,
          courseId,
        },
      });
    } catch (error) {
      await pgClient.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create order",
    });
  } finally {
    if (pgClient) pgClient.release();
  }
};

// Verify payment and complete purchase
export const verifyPayment = async (
  req: Request<{}, {}, VerifyPaymentRequest>,
  res: Response<ApiResponse<Purchase>>
): Promise<void> => {
  const userId = req.id;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, courseId } = req.body;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "User not authenticated",
    });
    return;
  }

  let pgClient;

  try {
    // Verify signature
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET_KEY!)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      res.status(400).json({
        success: false,
        message: "Payment verification failed. Invalid signature.",
      });
      return;
    }

    pgClient = await pgPool.connect();
    await pgClient.query("BEGIN");

    // Update purchase status
    const updateQuery = `
      UPDATE purchases SET
        status = 'completed',
        payment_id = $1,
        payment_signature = $2,
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $3 AND course_id = $4 AND order_id = $5
      RETURNING *
    `;

    const result = await pgClient.query<Purchase>(updateQuery, [
      razorpay_payment_id,
      razorpay_signature,
      userId,
      courseId,
      razorpay_order_id,
    ]);

    if (result.rows.length === 0) {
      await pgClient.query("ROLLBACK");
      res.status(404).json({
        success: false,
        message: "Purchase record not found",
      });
      return;
    }

    // Update user's enrolled courses
    const updateUserQuery = `
      UPDATE users SET
        enrolled_courses = COALESCE(enrolled_courses, '{}') || $1::text[],
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2 AND NOT ($1 = ANY(COALESCE(enrolled_courses, '{}')))
    `;
    
    await pgClient.query(updateUserQuery, [[courseId], userId]);

    await pgClient.query("COMMIT");

    const completedPurchase = result.rows[0];

    res.status(200).json({
      success: true,
      message: "Payment verified and course enrolled successfully!",
      data: completedPurchase,
    });
  } catch (error) {
    if (pgClient) await pgClient.query("ROLLBACK");
    console.error("Payment verification error:", error);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
    });
  } finally {
    if (pgClient) pgClient.release();
  }
};

// Get user's purchased courses
export const getMyCourses = async (
  req: Request,
  res: Response<ApiResponse<Array<Purchase & { course?: Course }>>>
): Promise<void> => {
  const userId = req.id;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "User not authenticated",
    });
    return;
  }

  try {
    // Get completed purchases
    const purchasesQuery = `
      SELECT * FROM purchases 
      WHERE user_id = $1 AND status = 'completed'
      ORDER BY completed_at DESC
    `;
    
    const purchaseResult = await query<Purchase>(purchasesQuery, [userId]);
    const purchases = purchaseResult.rows;

    // Get course details for each purchase
    const coursesWithDetails = await Promise.all(
      purchases.map(async (purchase) => {
        try {
          const { Item: course } = await ddbDocClient.send(
            new GetCommand({
              TableName: TABLE_NAMES.LMS,
              Key: { PK: `COURSE#${purchase.course_id}`, SK: "METADATA" },
            })
          );

          return {
            ...purchase,
            course: course as Course || null,
          };
        } catch (error) {
          console.error(`Error fetching course ${purchase.course_id}:`, error);
          return {
            ...purchase,
            course: null,
          };
        }
      })
    );

    res.status(200).json({
      success: true,
      data: coursesWithDetails,
    });
  } catch (error) {
    console.error("Get my courses error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get purchased courses",
    });
  }
};

// Check if user has purchased a specific course
export const checkPurchaseStatus = async (
  req: Request<{ courseId: string }>,
  res: Response<ApiResponse<{ isPurchased: boolean; purchase?: Purchase }>>
): Promise<void> => {
  const userId = req.id;
  const { courseId } = req.params;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "User not authenticated",
    });
    return;
  }

  try {
    const purchaseQuery = `
      SELECT * FROM purchases 
      WHERE user_id = $1 AND course_id = $2 AND status = 'completed'
    `;
    
    const result = await query<Purchase>(purchaseQuery, [userId, courseId]);
    const isPurchased = result.rows.length > 0;

    res.status(200).json({
      success: true,
      data: {
        isPurchased,
        purchase: isPurchased ? result.rows[0] : undefined,
      },
    });
  } catch (error) {
    console.error("Check purchase status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check purchase status",
    });
  }
};

// Get all purchases (admin)
export const getAllPurchases = async (
  req: Request,
  res: Response<ApiResponse<Purchase[]>>
): Promise<void> => {
  try {
    const purchasesQuery = `
      SELECT p.*, u.name as user_name, u.email as user_email
      FROM purchases p
      JOIN users u ON p.user_id = u.user_id
      ORDER BY p.created_at DESC
    `;
    
    const result = await query<Purchase & { user_name: string; user_email: string }>(purchasesQuery);

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get all purchases error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get purchases",
    });
  }
};