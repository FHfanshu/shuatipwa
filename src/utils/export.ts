/**
 * 下载 Blob 为文件（纯 DOM 工具，不属于任何业务层）
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revoke to ensure mobile browsers start the download
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
