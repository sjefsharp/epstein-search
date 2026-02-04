// Zustand store for chat state management with localStorage persistence
"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Message, ChatState } from "@/lib/types";

interface ChatStore extends ChatState {
  // Actions
  addMessage: (message: Omit<Message, "id" | "timestamp">) => string;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  setSearchMode: (mode: "fast" | "deep") => void;
  setLoading: (loading: boolean) => void;
  setCurrentQuery: (query: string) => void;
  clearMessages: () => void;
  deleteMessage: (id: string) => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      // Initial state
      messages: [],
      searchMode: "fast",
      isLoading: false,
      currentQuery: "",

      // Actions
      addMessage: (message) => {
        const newMessage: Message = {
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        };

        set((state) => ({
          messages: [...state.messages, newMessage],
        }));

        return newMessage.id;
      },

      updateMessage: (id, updates) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, ...updates } : msg,
          ),
        }));
      },

      setSearchMode: (mode) => {
        set({ searchMode: mode });
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setCurrentQuery: (query) => {
        set({ currentQuery: query });
      },

      clearMessages: () => {
        set({ messages: [] });
      },

      deleteMessage: (id) => {
        set((state) => ({
          messages: state.messages.filter((msg) => msg.id !== id),
        }));
      },
    }),
    {
      name: "epstein-chat-storage", // localStorage key
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist messages and searchMode
        messages: state.messages.slice(-50), // Keep only last 50 messages
        searchMode: state.searchMode,
      }),
    },
  ),
);

// Utility hooks
export const useMessages = () => useChatStore((state) => state.messages);
export const useSearchMode = () => useChatStore((state) => state.searchMode);
export const useIsLoading = () => useChatStore((state) => state.isLoading);
export const useCurrentQuery = () =>
  useChatStore((state) => state.currentQuery);
