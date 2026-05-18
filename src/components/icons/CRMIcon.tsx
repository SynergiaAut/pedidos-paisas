export function CRMIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            {/* Person/User */}
            <circle cx="9" cy="7" r="3" />
            <path d="M5 19a4 4 0 0 1 8 0" />

            {/* Connection lines */}
            <path d="M14 11h5" />
            <path d="M14 14h5" />
            <path d="M14 17h5" />

            {/* Data dots */}
            <circle cx="20" cy="11" r="1" fill="currentColor" />
            <circle cx="20" cy="14" r="1" fill="currentColor" />
            <circle cx="20" cy="17" r="1" fill="currentColor" />
        </svg>
    );
}
