"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { type User } from "@supabase/supabase-js";
import BookmarkCard from "./BookmarkCard";
import Toast from "./Toast";

interface Bookmark {
    id: string;
    user_id: string;
    title: string;
    url: string;
    created_at: string;
}

interface DashboardClientProps {
    initialBookmarks: Bookmark[];
    user: User;
}

export default function DashboardClient({
    initialBookmarks,
    user,
}: DashboardClientProps) {
    const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks);
    const [title, setTitle] = useState("");
    const [url, setUrl] = useState("");
    const [search, setSearch] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error";
    } | null>(null);

    const supabase = createClient();

    const showToast = useCallback(
        (message: string, type: "success" | "error") => {
            setToast({ message, type });
        },
        []
    );

    // Realtime subscription
    useEffect(() => {
        const channel = supabase
            .channel("bookmarks-realtime")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "bookmarks",
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    setBookmarks((prev) => {
                        const exists = prev.some((b) => b.id === payload.new.id);
                        if (exists) return prev;
                        return [payload.new as Bookmark, ...prev];
                    });
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "bookmarks",
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    setBookmarks((prev) =>
                        prev.filter((b) => b.id !== payload.old.id)
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, user.id]);

    // Validate URL
    const isValidUrl = (str: string) => {
        try {
            const urlObj = new URL(str);
            return urlObj.protocol === "http:" || urlObj.protocol === "https:";
        } catch {
            return false;
        }
    };

    // Add Bookmark
    const handleAddBookmark = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            showToast("Please enter a title", "error");
            return;
        }

        let finalUrl = url.trim();
        if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
            finalUrl = "https://" + finalUrl;
        }

        if (!isValidUrl(finalUrl)) {
            showToast("Please enter a valid URL", "error");
            return;
        }

        setIsAdding(true);

        const { error } = await supabase.from("bookmarks").insert({
            title: title.trim(),
            url: finalUrl,
            user_id: user.id,
        });

        if (error) {
            showToast("Failed to add bookmark", "error");
        } else {
            showToast("Bookmark added!", "success");
            setTitle("");
            setUrl("");
        }

        setIsAdding(false);
    };

    // Delete Bookmark
    const handleDeleteBookmark = async (id: string) => {
        const { error } = await supabase
            .from("bookmarks")
            .delete()
            .eq("id", id);

        if (error) {
            showToast("Failed to delete bookmark", "error");
        } else {
            showToast("Bookmark deleted", "success");
        }
    };

    // Logout
    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
    };

    // Filter bookmarks
    const filteredBookmarks = bookmarks.filter(
        (b) =>
            b.title.toLowerCase().includes(search.toLowerCase()) ||
            b.url.toLowerCase().includes(search.toLowerCase())
    );

    const userAvatar = user.user_metadata?.avatar_url;
    const userName =
        user.user_metadata?.full_name || user.email || "User";

    return (
        <div className="dashboard">
            {/* Header */}
            <header className="dashboard-header">
                <div className="header-left">
                    <div className="header-logo">
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                    </div>
                    <h1 className="header-title">Smart Bookmark</h1>
                </div>

                <div className="header-right">
                    <div className="user-info">
                        {userAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={userAvatar}
                                alt={userName}
                                className="user-avatar"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <div className="user-avatar-fallback">
                                {userName.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className="user-name">{userName}</span>
                    </div>
                    <button onClick={handleLogout} className="logout-btn" title="Sign out">
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="dashboard-main">
                {/* Add Bookmark Form */}
                <form onSubmit={handleAddBookmark} className="add-form">
                    <div className="add-form-header">
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="16" />
                            <line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                        <span>Add New Bookmark</span>
                    </div>
                    <div className="add-form-fields">
                        <input
                            type="text"
                            placeholder="Bookmark title..."
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="input-field"
                            id="title-input"
                        />
                        <input
                            type="text"
                            placeholder="https://example.com"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="input-field"
                            id="url-input"
                        />
                        <button
                            type="submit"
                            disabled={isAdding}
                            className="add-btn"
                            id="add-bookmark-btn"
                        >
                            {isAdding ? (
                                <span className="spinner" />
                            ) : (
                                <>
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                    >
                                        <line x1="12" y1="5" x2="12" y2="19" />
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                    Add
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {/* Search & Stats */}
                <div className="controls-bar">
                    <div className="search-wrapper">
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search bookmarks..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="search-input"
                            id="search-input"
                        />
                    </div>
                    <span className="bookmark-count">
                        {filteredBookmarks.length}{" "}
                        {filteredBookmarks.length === 1 ? "bookmark" : "bookmarks"}
                    </span>
                </div>

                {/* Bookmark Grid */}
                {filteredBookmarks.length === 0 ? (
                    <div className="empty-state">
                        <svg
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                        >
                            <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                        <h3>
                            {search ? "No bookmarks match your search" : "No bookmarks yet"}
                        </h3>
                        <p>
                            {search
                                ? "Try a different search term"
                                : "Add your first bookmark above to get started!"}
                        </p>
                    </div>
                ) : (
                    <div className="bookmark-grid">
                        {filteredBookmarks.map((bookmark) => (
                            <BookmarkCard
                                key={bookmark.id}
                                bookmark={bookmark}
                                onDelete={handleDeleteBookmark}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* Toast */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}
