"use client";

import { useState } from "react";

interface BookmarkCardProps {
    bookmark: {
        id: string;
        title: string;
        url: string;
        created_at: string;
    };
    onDelete: (id: string) => void;
}

export default function BookmarkCard({
    bookmark,
    onDelete,
}: BookmarkCardProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        await onDelete(bookmark.id);
        setIsDeleting(false);
        setShowConfirm(false);
    };

    const truncateUrl = (url: string, max: number = 40) => {
        try {
            const parsed = new URL(url);
            const display = parsed.hostname + parsed.pathname;
            return display.length > max ? display.substring(0, max) + "…" : display;
        } catch {
            return url.length > max ? url.substring(0, max) + "…" : url;
        }
    };

    const getFaviconUrl = (url: string) => {
        try {
            const parsed = new URL(url);
            return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`;
        } catch {
            return null;
        }
    };

    const timeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const favicon = getFaviconUrl(bookmark.url);

    return (
        <div className={`bookmark-card ${isDeleting ? "deleting" : ""}`}>
            <div className="card-content">
                <a
                    href={bookmark.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card-link"
                >
                    <div className="card-icon">
                        {favicon ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={favicon} alt="" width={20} height={20} />
                        ) : (
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="2" y1="12" x2="22" y2="12" />
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                        )}
                    </div>
                    <div className="card-text">
                        <h3 className="card-title">{bookmark.title}</h3>
                        <p className="card-url">{truncateUrl(bookmark.url)}</p>
                    </div>
                    <svg
                        className="external-icon"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                </a>
            </div>

            <div className="card-footer">
                <span className="card-time">{timeAgo(bookmark.created_at)}</span>

                {showConfirm ? (
                    <div className="confirm-delete">
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="confirm-yes"
                        >
                            {isDeleting ? "…" : "Delete"}
                        </button>
                        <button
                            onClick={() => setShowConfirm(false)}
                            className="confirm-no"
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowConfirm(true)}
                        className="delete-btn"
                        title="Delete bookmark"
                    >
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
}
