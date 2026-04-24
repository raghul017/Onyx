import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="text-center">
        <p className="font-['JetBrains_Mono'] text-cyan-500 text-sm tracking-widest uppercase mb-4">
          404
        </p>
        <h1 className="font-['Satoshi_Variable',sans-serif] text-4xl text-white font-normal mb-3 tracking-tight">
          Page not found
        </h1>
        <p className="text-neutral-500 font-['Inter',sans-serif] text-base mb-8">
          The route{" "}
          <code className="font-['JetBrains_Mono'] text-neutral-400 bg-neutral-900 px-1.5 py-0.5 rounded text-sm">
            {location.pathname}
          </code>{" "}
          does not exist.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 text-cyan-400 font-['Inter',sans-serif] text-sm hover:underline transition-colors"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
