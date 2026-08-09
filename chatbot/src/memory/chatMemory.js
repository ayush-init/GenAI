/**
 * In-Memory Conversation History Manager.
 * Stores multi-turn user and assistant interactions.
 */
export class ConversationMemory {
    constructor(maxTurns = 10) {
        this.history = [];
        this.maxTurns = maxTurns;
    }

    /**
     * Add a turn (user question and assistant response) to memory.
     */
    addTurn(userMessage, assistantResponse) {
        this.history.push({
            role: "user",
            content: userMessage,
            timestamp: new Date().toISOString(),
        });

        this.history.push({
            role: "assistant",
            content: assistantResponse,
            timestamp: new Date().toISOString(),
        });

        // Retain only the last maxTurns exchanges (2 messages per turn)
        if (this.history.length > this.maxTurns * 2) {
            this.history = this.history.slice(-this.maxTurns * 2);
        }
    }

    /**
     * Get array of history turns.
     */
    getHistory() {
        return this.history;
    }

    /**
     * Format conversation history as plain text for LLM prompts.
     */
    formatHistory() {
        if (this.history.length === 0) {
            return "No previous conversation history.";
        }

        return this.history
            .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
            .join("\n");
    }

    /**
     * Clear all conversation history.
     */
    clear() {
        this.history = [];
        console.log("🧹 Conversation history cleared.");
    }
}
