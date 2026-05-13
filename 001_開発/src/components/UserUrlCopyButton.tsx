"use client";

type UserUrlCopyButtonProps = {
  username: string;
  label?: string;
  className?: string;
};

export default function UserUrlCopyButton({
  username,
  label = "URLコピー",
  className = "text-x-gray hover:text-x-blue text-xs transition-colors",
}: UserUrlCopyButtonProps) {
  async function handleCopy() {
    const url = `https://x.com/${username}`;
    try {
      await navigator.clipboard.writeText(url);
      alert(`@${username} のURLをコピーしました`);
    } catch {
      prompt("このURLをコピーしてください", url);
    }
  }

  return (
    <button type="button" onClick={handleCopy} className={className}>
      {label}
    </button>
  );
}
