"use client";
import React, { useRef, useEffect } from "react";

export default function CommandLog({ log = [] }) {
  const logAreaRef = useRef(null);

  useEffect(() => {
    const ta = logAreaRef.current;
    if (!ta) return;
    ta.scrollTop = ta.scrollHeight;
  }, [log]);
  return (
    <textarea
      ref={logAreaRef}
      readOnly
      className="command-log"
      value={log.join("\n")}
      rows={Math.max(log.length + 3, 10)}
    />
  );
}
