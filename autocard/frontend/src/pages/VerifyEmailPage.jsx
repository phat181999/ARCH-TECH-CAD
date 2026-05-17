import { useState, useEffect } from "react";
import { auth } from "../api/client";

export default function VerifyEmailPage() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) {
      setToken(t);
      verify(t);
    }
  }, []);

  const verify = async (t) => {
    setStatus("loading");
    try {
      const data = await auth.verifyEmail({ token: t || token });
      setStatus("success");
      setMessage(data.message || "Email verified successfully!");
    } catch (err) {
      setStatus("error");
      setMessage(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Email Verification</h2>
        {status === "loading" && (
          <div className="text-blue-600">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Verifying your email...</p>
          </div>
        )}
        {status === "success" && (
          <div className="text-green-600">
            <div className="text-5xl mb-4">&#10003;</div>
            <p className="text-lg font-medium">{message}</p>
            <p className="mt-2 text-gray-600">You can now close this window and sign in.</p>
          </div>
        )}
        {status === "error" && (
          <div className="text-red-600">
            <div className="text-5xl mb-4">&#10007;</div>
            <p className="text-lg font-medium">{message}</p>
          </div>
        )}
        {status === "idle" && (
          <div>
            <p className="text-gray-600 mb-4">Enter your verification token:</p>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
              placeholder="Paste verification token"
            />
            <button
              onClick={() => verify()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Verify
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
