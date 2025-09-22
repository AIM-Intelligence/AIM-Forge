interface Xprops {
  onClose: () => void;
}

export default function X({ onClose }: Xprops) {
  return (
    <button
      className="p-2 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all duration-200 ease-in-out cursor-pointer flex items-center justify-center active:scale-95"
      onClick={onClose}
      aria-label="Close modal"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M18 6L6 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6 6L18 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
