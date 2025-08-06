// ts-client/src/utils/authDebug.ts
// Authentication debugging utility

import { store } from "@/app/store";

interface AuthDebugInfo {
  timestamp: string;
  reduxAuth: {
    isAuthenticated: boolean;
    user: any;
    token: string | null;
  };
  localStorage: {
    authToken: string | null;
    allKeys: string[];
  };
  cookies: {
    tokenPresent: boolean;
    allCookies: string;
  };
  apiBaseUrl: string;
  browserInfo: {
    userAgent: string;
    isChrome: boolean;
  };
}

/**
 * Comprehensive authentication state debugger
 */
export const debugAuthState = (): AuthDebugInfo => {
  const state = store.getState();
  const authState = state.auth;

  const debugInfo: AuthDebugInfo = {
    timestamp: new Date().toISOString(),
    reduxAuth: {
      isAuthenticated: authState.isAuthenticated,
      user: authState.user,
      token: authState.token,
    },
    localStorage: {
      authToken: localStorage.getItem("auth_token"),
      allKeys: Object.keys(localStorage),
    },
    cookies: {
      tokenPresent: document.cookie.includes("token="),
      allCookies: document.cookie,
    },
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "NOT_SET",
    browserInfo: {
      userAgent: navigator.userAgent,
      isChrome: navigator.userAgent.includes("Chrome"),
    },
  };

  console.group("🔍 Authentication Debug Info");
  console.log("📅 Timestamp:", debugInfo.timestamp);
  console.log("🔐 Redux Auth State:", debugInfo.reduxAuth);
  console.log("💾 LocalStorage:", debugInfo.localStorage);
  console.log("🍪 Cookies:", debugInfo.cookies);
  console.log("🌐 API Base URL:", debugInfo.apiBaseUrl);
  console.log("🖥️ Browser Info:", debugInfo.browserInfo);
  console.groupEnd();

  return debugInfo;
};

/**
 * Test API connectivity
 */
export const testApiConnectivity = async (): Promise<{
  success: boolean;
  status?: number;
  message: string;
  url: string;
}> => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  const healthUrl = `${baseUrl}/health`;

  try {
    console.log("🔍 Testing API connectivity to:", healthUrl);

    const response = await fetch(healthUrl, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    console.log("✅ API Response:", data);

    return {
      success: response.ok,
      status: response.status,
      message: data.message || "API connected successfully",
      url: healthUrl,
    };
  } catch (error: any) {
    console.error("❌ API connectivity test failed:", error);

    return {
      success: false,
      message: error.message || "Failed to connect to API",
      url: healthUrl,
    };
  }
};

/**
 * Test profile API endpoint
 */
export const testProfileApi = async (): Promise<{
  success: boolean;
  status?: number;
  data?: any;
  error?: string;
}> => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  const profileUrl = `${baseUrl}/user/profile`;
  const authToken = localStorage.getItem("auth_token");

  try {
    console.log("🔍 Testing profile API:", profileUrl);
    console.log("🔑 Using token:", authToken ? "Present" : "Not found");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(profileUrl, {
      method: "GET",
      credentials: "include",
      headers,
    });

    const data = await response.json();

    console.log("📊 Profile API Response:", {
      status: response.status,
      ok: response.ok,
      data,
    });

    return {
      success: response.ok,
      status: response.status,
      data,
    };
  } catch (error: any) {
    console.error("❌ Profile API test failed:", error);

    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Clear all authentication data
 */
export const clearAllAuthData = (): void => {
  console.log("🧹 Clearing all authentication data...");

  // Clear localStorage
  localStorage.removeItem("auth_token");
  localStorage.removeItem("user");

  // Clear any other auth-related localStorage items
  Object.keys(localStorage).forEach((key) => {
    if (key.includes("auth") || key.includes("token") || key.includes("user")) {
      localStorage.removeItem(key);
    }
  });

  // Clear sessionStorage
  sessionStorage.clear();

  // Clear cookies (best effort - some are HTTP-only)
  document.cookie.split(";").forEach((cookie) => {
    const eqPos = cookie.indexOf("=");
    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
    if (name.includes("token") || name.includes("auth")) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  });

  console.log("✅ Authentication data cleared");
};

/**
 * Run complete authentication diagnostics
 */
export const runAuthDiagnostics = async (): Promise<void> => {
  console.group("🔬 Running Authentication Diagnostics");

  // 1. Debug current state
  console.log("1️⃣ Current authentication state:");
  debugAuthState();

  // 2. Test API connectivity
  console.log("2️⃣ Testing API connectivity:");
  const apiTest = await testApiConnectivity();
  console.log(apiTest.success ? "✅" : "❌", apiTest.message);

  // 3. Test profile endpoint
  console.log("3️⃣ Testing profile endpoint:");
  const profileTest = await testProfileApi();
  console.log(profileTest.success ? "✅" : "❌", "Profile API test completed");

  console.groupEnd();
};

// Export for global access in browser console
if (typeof window !== "undefined") {
  (window as any).authDebug = {
    debugAuthState,
    testApiConnectivity,
    testProfileApi,
    clearAllAuthData,
    runAuthDiagnostics,
  };

  console.log("🔧 Auth debug utilities available at window.authDebug");
}
