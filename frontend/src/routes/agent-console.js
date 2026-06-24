import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { GlassCard, RiskBadge } from "@/components/dashboard/widgets";
import { Bot, User, Send, Wrench, ShieldCheck, Zap, AlertTriangle, Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { chatAPI } from "@/services/api";
const iconForPhase = {
    "User Prompt": User,
    "Tool Selected": Wrench,
    "Policy Evaluation": ShieldCheck,
    "Tool Execution": Zap,
    "Final Response": Bot,
};
export function AgentConsolePage() {
    const [messages, setMessages] = useState([]);
    const [timeline, setTimeline] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const sendMessage = async () => {
        if (!input.trim() || loading)
            return;
        const userMessage = input;
        setInput("");
        setLoading(true);
        setMessages(prev => [...prev, { role: "user", content: userMessage }]);
        try {
            const result = await chatAPI.sendMessage(userMessage);
            if (result.conversation_log) {
                setTimeline(result.conversation_log);
            }
            if (result.response) {
                setMessages(prev => [...prev, { role: "assistant", content: result.response }]);
            }
            else if (result.status === "pending_approval") {
                setMessages(prev => [...prev, {
                        role: "system",
                        content: `⏸ ${result.message}. Approval ID: ${result.approval_id}`
                    }]);
            }
        }
        catch (error) {
            setMessages(prev => [...prev, {
                    role: "error",
                    content: `Error: ${error.message}`
                }]);
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-5", children: [_jsxs(GlassCard, { className: "p-5 lg:col-span-3", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("div", { className: "relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow", children: [_jsx(Bot, { className: "h-4 w-4 text-white" }), _jsx("span", { className: "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success ring-2 ring-card" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-semibold", children: "armoriq-agent" }), _jsx("div", { className: "text-[10px] text-muted-foreground font-mono", children: "gemini-1.5-flash \u00B7 notes-server" })] })] }), _jsx(RiskBadge, { level: "medium" })] }), _jsxs("div", { className: "space-y-4 mb-6 max-h-96 overflow-y-auto", children: [messages.length === 0 && (_jsx("div", { className: "text-center py-8 text-muted-foreground text-sm", children: "Send a message to start chatting with the agent" })), messages.map((msg, i) => (_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", msg.role === "user" ? "bg-muted/50" :
                                            msg.role === "assistant" ? "bg-gradient-to-br from-primary to-primary-glow text-white" :
                                                "bg-warning/20"), children: msg.role === "user" ? _jsx(User, { className: "h-4 w-4" }) : _jsx(Bot, { className: "h-4 w-4" }) }), _jsx("div", { className: cn("rounded-lg rounded-tl-none border px-3 py-2 text-sm flex-1", msg.role === "assistant" ? "border-primary/30 bg-primary/5" : "border-border bg-card/40"), children: msg.content })] }, i))), loading && (_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-glow text-white", children: _jsx(Bot, { className: "h-4 w-4 animate-pulse" }) }), _jsx("div", { className: "rounded-lg rounded-tl-none border border-primary/30 bg-primary/5 px-3 py-2 text-sm", children: "Thinking..." })] }))] }), _jsxs("div", { className: "flex items-center gap-2 rounded-lg border border-border bg-card/40 p-2", children: [_jsx("input", { value: input, onChange: (e) => setInput(e.target.value), onKeyPress: (e) => e.key === "Enter" && sendMessage(), placeholder: "Ask me to create notes, list them, or anything else...", className: "flex-1 bg-transparent px-2 text-sm placeholder:text-muted-foreground/70 focus:outline-none", disabled: loading }), _jsxs("button", { onClick: sendMessage, disabled: loading || !input.trim(), className: "inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-primary to-primary-glow px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50", children: [_jsx(Send, { className: "h-3.5 w-3.5" }), " Send"] })] })] }), _jsxs(GlassCard, { className: "p-5 lg:col-span-2", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsx("h2", { className: "text-sm font-semibold uppercase tracking-wider text-muted-foreground", children: "Reasoning Timeline" }), timeline.length > 0 && (_jsxs("span", { className: "inline-flex items-center gap-1.5 text-xs text-success", children: [_jsxs("span", { className: "relative flex h-2 w-2", children: [_jsx("span", { className: "absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" }), _jsx("span", { className: "relative inline-flex h-2 w-2 rounded-full bg-success" })] }), "Live"] }))] }), _jsxs("ol", { className: "relative space-y-3 border-l border-border pl-6", children: [timeline.length === 0 && (_jsx("li", { className: "text-xs text-muted-foreground", children: "No activity yet" })), timeline.map((step, i) => {
                                const Icon = iconForPhase[step.phase] ?? Bot;
                                const tone = step.status === "warning" ? "bg-warning/20 text-warning ring-warning/40" :
                                    step.status === "pending" ? "bg-muted/30 text-muted-foreground ring-border animate-pulse" :
                                        "bg-success/20 text-success ring-success/40";
                                return (_jsxs("li", { className: "relative animate-fade-in-up", style: { animationDelay: `${i * 60}ms` }, children: [_jsx("span", { className: cn("absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-background", tone), children: _jsx(Icon, { className: "h-3 w-3" }) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xs font-semibold", children: step.phase }), step.status === "warning" && (_jsxs("span", { className: "inline-flex items-center gap-1 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning", children: [_jsx(AlertTriangle, { className: "h-2.5 w-2.5" }), " blocked"] })), step.status === "done" && _jsx(Check, { className: "h-3 w-3 text-success" }), step.status === "pending" && _jsx(Clock, { className: "h-3 w-3 text-muted-foreground" })] }), _jsx("p", { className: "mt-0.5 text-xs text-muted-foreground", children: step.content })] }, i));
                            })] })] })] }));
}
