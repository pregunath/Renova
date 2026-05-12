"use client";

import "@ant-design/v5-patch-for-react-19";

// enable Antd v5 compatibility with React 19
// used for antd toast messages in Moodboard
export function AntdPatchClient({ children }) {
  return children;
}
