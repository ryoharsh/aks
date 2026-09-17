export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
    public: {
        Tables: {
            data_sources: {
                Row: {
                    user_id: string;
                    source_type: string;
                    name: string;
                    enabled: boolean;
                    metadata: Json;
                    connected_at: string;
                    disconnected_at: string | null;
                };
                Insert: {
                    user_id: string;
                    source_type: string;
                    name: string;
                    enabled?: boolean;
                    metadata?: Json;
                    connected_at?: string;
                    disconnected_at?: string | null;
                };
                Update: {
                    source_type?: string;
                    name?: string;
                    enabled?: boolean;
                    metadata?: Json;
                    connected_at?: string;
                    disconnected_at?: string | null;
                };
                Relationships: [];
            };
            user_preferences: {
                Row: {
                    user_id: string;
                    appearance: "system" | "light" | "dark";
                    what_exploring: string[];
                    what_to_notice: string[];
                    updated_at: string;
                };
                Insert: {
                    user_id: string;
                    appearance?: "system" | "light" | "dark";
                    what_exploring?: string[];
                    what_to_notice?: string[];
                    updated_at?: string;
                };
                Update: {
                    appearance?: "system" | "light" | "dark";
                    what_exploring?: string[];
                    what_to_notice?: string[];
                    updated_at?: string;
                };
                Relationships: [];
            };
            subscriptions: {
                Row: {
                    user_id: string;
                    revenuecat_customer_id: string;
                    entitlement: string;
                    product_id: string | null;
                    status: "active" | "cancelled" | "expired" | "billing_issue";
                    expires_at: string | null;
                    updated_at: string;
                };
                Insert: never;
                Update: never;
                Relationships: [];
            };
            legal_acceptances: {
                Row: {
                    user_id: string;
                    terms_version: string;
                    privacy_version: string;
                    accepted_at: string;
                };
                Insert: never;
                Update: never;
                Relationships: [];
            };
            conversations: {
                Row: {
                    id: string;
                    user_id: string;
                    title: string;
                    created_at: string;
                    updated_at: string;
                    archived_at: string | null;
                };
                Insert: {
                    id?: string;
                    user_id?: string;
                    title?: string;
                    created_at?: string;
                    updated_at?: string;
                    archived_at?: string | null;
                };
                Update: {
                    title?: string;
                    updated_at?: string;
                    archived_at?: string | null;
                };
                Relationships: [];
            };
            messages: {
                Row: {
                    id: string;
                    conversation_id: string;
                    user_id: string;
                    role: Database["public"]["Enums"]["message_role"];
                    content: string;
                    client_request_id: string | null;
                    reply_to_message_id: string | null;
                    metadata: Json;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    conversation_id: string;
                    user_id?: string;
                    role: Database["public"]["Enums"]["message_role"];
                    content: string;
                    client_request_id?: string | null;
                    reply_to_message_id?: string | null;
                    metadata?: Json;
                    created_at?: string;
                };
                Update: {
                    conversation_id?: string;
                    role?: Database["public"]["Enums"]["message_role"];
                    content?: string;
                    client_request_id?: string | null;
                    reply_to_message_id?: string | null;
                    metadata?: Json;
                };
                Relationships: [];
            };
            reflections: {
                Row: {
                    id: string;
                    user_id: string;
                    content: string;
                    metadata: Json;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id?: string;
                    content: string;
                    metadata?: Json;
                    created_at?: string;
                };
                Update: {
                    content?: string;
                    metadata?: Json;
                };
                Relationships: [];
            };
            check_ins: {
                Row: {
                    id: string;
                    user_id: string;
                    mood: string | null;
                    energy: number | null;
                    focus: number | null;
                    stress: number | null;
                    notes: string | null;
                    metadata: Json;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id?: string;
                    mood?: string | null;
                    energy?: number | null;
                    focus?: number | null;
                    stress?: number | null;
                    notes?: string | null;
                    metadata?: Json;
                    created_at?: string;
                };
                Update: {
                    mood?: string | null;
                    energy?: number | null;
                    focus?: number | null;
                    stress?: number | null;
                    notes?: string | null;
                    metadata?: Json;
                };
                Relationships: [];
            };
            signals: {
                Row: {
                    id: string;
                    user_id: string;
                    source_type: Database["public"]["Enums"]["signal_source_type"];
                    source_id: string;
                    source_message_id: string | null;
                    signal_type: string;
                    value: Json;
                    confidence: number | null;
                    observed_at: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id?: string;
                    source_type: Database["public"]["Enums"]["signal_source_type"];
                    source_id: string;
                    source_message_id?: string | null;
                    signal_type: string;
                    value: Json;
                    confidence?: number | null;
                    observed_at: string;
                    created_at?: string;
                };
                Update: {
                    source_type?: Database["public"]["Enums"]["signal_source_type"];
                    source_id?: string;
                    source_message_id?: string | null;
                    signal_type?: string;
                    value?: Json;
                    confidence?: number | null;
                    observed_at?: string;
                };
                Relationships: [];
            };
            memories: {
                Row: {
                    id: string;
                    user_id: string;
                    memory_type: string;
                    content: string;
                    normalized_content: string;
                    status: "candidate" | "active" | "rejected" | "archived";
                    confidence: number | null;
                    evidence_count: number;
                    first_observed_at: string;
                    last_observed_at: string;
                    metadata: Json;
                    created_at: string;
                    updated_at: string;
                };
                Insert: never;
                Update: never;
                Relationships: [];
            };
            memory_evidence: {
                Row: {
                    id: string;
                    memory_id: string;
                    user_id: string;
                    signal_id: string | null;
                    message_id: string | null;
                    reflection_id: string | null;
                    check_in_id: string | null;
                    observed_at: string;
                    created_at: string;
                };
                Insert: never;
                Update: never;
                Relationships: [];
            };
            patterns: {
                Row: {
                    id: string;
                    user_id: string;
                    title: string;
                    description: string;
                    canonical_key: string;
                    status: "candidate" | "possible" | "testing" | "supported" | "not_supported" | "archived";
                    confidence: number | null;
                    evidence_count: number;
                    first_detected_at: string;
                    last_observed_at: string;
                    metadata: Json;
                    created_at: string;
                    updated_at: string;
                };
                Insert: never;
                Update: never;
                Relationships: [];
            };
            pattern_evidence: {
                Row: {
                    id: string;
                    pattern_id: string;
                    user_id: string;
                    signal_id: string;
                    relationship: "supporting" | "contradicting";
                    observed_at: string;
                    created_at: string;
                };
                Insert: never;
                Update: never;
                Relationships: [];
            };
            experiments: {
                Row: {
                    id: string;
                    user_id: string;
                    pattern_id: string | null;
                    title: string;
                    hypothesis: string;
                    description: string;
                    status: "draft" | "active" | "completed" | "cancelled";
                    start_date: string | null;
                    end_date: string | null;
                    result: "supports" | "mixed" | "does_not_support" | "insufficient_data" | null;
                    result_summary: string | null;
                    confidence: number | null;
                    observation_count: number;
                    sort_priority: number;
                    metadata: Json;
                    created_at: string;
                    updated_at: string;
                    completed_at: string | null;
                    learning_status: "pending" | "succeeded" | "failed" | "not_applicable" | null;
                    insight_status: "pending" | "succeeded" | "failed" | "exhausted" | "not_applicable" | null;
                };
                Insert: never;
                Update: never;
                Relationships: [];
            };
            experiment_observations: {
                Row: {
                    id: string;
                    experiment_id: string;
                    user_id: string;
                    value: Json;
                    notes: string | null;
                    client_request_id: string;
                    observed_at: string;
                    created_at: string;
                };
                Insert: never;
                Update: never;
                Relationships: [];
            };
            learnings: {
                Row: {
                    id: string;
                    user_id: string;
                    title: string;
                    description: string;
                    canonical_key: string;
                    confidence: number | null;
                    evidence_count: number;
                    source_experiment_id: string | null;
                    status: "active" | "revised" | "archived";
                    metadata: Json;
                    created_at: string;
                    updated_at: string;
                };
                Insert: never;
                Update: never;
                Relationships: [];
            };
            learning_evidence: {
                Row: {
                    id: string;
                    learning_id: string;
                    user_id: string;
                    experiment_id: string;
                    relationship: "supports" | "mixed" | "contradicts";
                    observed_at: string;
                    created_at: string;
                };
                Insert: never;
                Update: never;
                Relationships: [];
            };
            insights: {
                Row: {
                    id: string;
                    user_id: string;
                    type: string;
                    title: string;
                    content: string;
                    pattern_id: string | null;
                    experiment_id: string | null;
                    learning_id: string | null;
                    confidence: number | null;
                    status: "new" | "seen" | "dismissed" | "archived";
                    seen_at: string | null;
                    metadata: Json;
                    created_at: string;
                    updated_at: string;
                };
                Insert: never;
                Update: never;
                Relationships: [];
            };
            timeline_events: {
                Row: {
                    id: string;
                    user_id: string;
                    event_type: string;
                    title: string;
                    description: string | null;
                    reference_id: string | null;
                    metadata: Json;
                    created_at: string;
                };
                Insert: never;
                Update: never;
                Relationships: [];
            };
            ai_runs: {
                Row: {
                    id: string;
                    user_id: string;
                    conversation_id: string | null;
                    user_message_id: string | null;
                    experiment_id: string | null;
                    attempt_token: string;
                    task: string;
                    status: "started" | "succeeded" | "failed";
                    provider: string | null;
                    model: string | null;
                    latency_ms: number | null;
                    input_tokens: number | null;
                    output_tokens: number | null;
                    error_code: string | null;
                    created_at: string;
                    attempted_at: string;
                    attempt_count: number;
                    completed_at: string | null;
                };
                Insert: never;
                Update: never;
                Relationships: [];
            };
            ai_run_attempts: {
                Row: {
                    id: number;
                    run_id: string;
                    user_id: string;
                    task: string;
                    attempted_at: string;
                };
                Insert: never;
                Update: never;
                Relationships: [];
            };
        };
        Views: Record<string, never>;
        Functions: {
            accept_current_legal: {
                Args: Record<PropertyKey, never>;
                Returns: undefined;
            };
            create_conversation_with_message: {
                Args: {
                    target_conversation_id: string | null;
                    conversation_title: string;
                    message_content: string;
                    request_id: string;
                    message_metadata?: Json;
                };
                Returns: Json;
            };
            claim_ai_run: {
                Args: {
                    run_user_id: string;
                    run_conversation_id: string;
                    run_user_message_id: string;
                    run_task: string;
                };
                Returns: Json;
            };
            archive_memory: {
                Args: { target_memory_id: string };
                Returns: boolean;
            };
            delete_memory: {
                Args: { target_memory_id: string };
                Returns: boolean;
            };
            apply_memory_evaluation: {
                Args: {
                    memory_user_id: string;
                    target_memory_id: string | null;
                    evaluated_memory_type: string;
                    evaluated_content: string;
                    evaluated_normalized_content: string;
                    evaluated_status: "candidate" | "active" | "rejected";
                    evaluated_confidence: number | null;
                    evaluated_metadata: Json;
                    evidence_signal_ids: string[];
                    evaluation_run_id: string;
                };
                Returns: Json;
            };
            archive_pattern: {
                Args: { target_pattern_id: string };
                Returns: boolean;
            };
            delete_pattern: {
                Args: { target_pattern_id: string };
                Returns: boolean;
            };
            apply_pattern_analysis: {
                Args: {
                    pattern_user_id: string;
                    target_pattern_id: string | null;
                    analyzed_title: string;
                    analyzed_description: string;
                    analyzed_canonical_key: string;
                    analyzed_status: "candidate" | "possible" | "supported" | "not_supported";
                    analyzed_confidence: number | null;
                    analyzed_metadata: Json;
                    evidence_signal_ids: string[];
                    evidence_relationship: "supporting" | "contradicting";
                    analysis_run_id: string;
                };
                Returns: Json;
            };
            claim_experiment_ai_run: {
                Args: { run_user_id: string; run_experiment_id: string };
                Returns: Json;
            };
            start_experiment: {
                Args: { experiment_user_id: string; target_experiment_id: string };
                Returns: Json;
            };
            record_experiment_observation: {
                Args: { experiment_user_id: string; target_experiment_id: string; observation_value: Json; observation_notes: string | null; request_id: string };
                Returns: Json;
            };
            finish_experiment: {
                Args: { experiment_user_id: string; target_experiment_id: string };
                Returns: Json;
            };
            cancel_experiment: {
                Args: { experiment_user_id: string; target_experiment_id: string };
                Returns: boolean;
            };
            save_experiment_outcome: {
                Args: { experiment_user_id: string; target_experiment_id: string; outcome_result: string; outcome_summary: string; outcome_confidence: number | null; outcome_metrics: Json; outcome_interpretation: string | null; outcome_analysis_status: string };
                Returns: Json;
            };
            delete_experiment: {
                Args: { experiment_user_id: string; target_experiment_id: string };
                Returns: boolean;
            };
            claim_learning_ai_run: {
                Args: { run_user_id: string; run_experiment_id: string };
                Returns: Json;
            };
            apply_learning_synthesis: {
                Args: { learning_user_id: string; target_learning_id: string | null; source_experiment: string; synthesized_title: string; synthesized_description: string; synthesized_canonical_key: string; synthesized_status: "active" | "revised"; synthesized_confidence: number | null; synthesized_metadata: Json; evidence_experiment_ids: string[]; evidence_relationship: "supports" | "mixed" | "contradicts"; synthesis_run_id: string; synthesis_attempt_token: string };
                Returns: Json;
            };
            set_experiment_learning_status: {
                Args: { experiment_user_id: string; target_experiment_id: string; new_status: string };
                Returns: boolean;
            };
            archive_learning: {
                Args: { target_learning_id: string };
                Returns: boolean;
            };
            delete_learning: {
                Args: { target_learning_id: string };
                Returns: boolean;
            };
            claim_insight_ai_run: { Args: { run_user_id: string; run_experiment_id: string }; Returns: Json };
            apply_insight_generation: { Args: { insight_user_id: string; source_pattern_id: string | null; source_experiment_id: string; source_learning_id: string; insight_type: string; insight_title: string; insight_content: string; insight_confidence: number | null; insight_metadata: Json; source_learning_updated_at: string; source_learning_evidence_count: number; source_experiment_result: string; source_experiment_observation_count: number; source_pattern_updated_at: string | null; generation_run_id: string; generation_attempt_token: string }; Returns: Json };
            mark_insight_seen: { Args: { target_insight_id: string }; Returns: boolean };
            dismiss_insight: { Args: { target_insight_id: string }; Returns: boolean };
            archive_insight: { Args: { target_insight_id: string }; Returns: boolean };
            delete_insight: { Args: { target_insight_id: string }; Returns: boolean };
            set_experiment_insight_status: { Args: { experiment_user_id: string; target_experiment_id: string; new_status: string }; Returns: boolean };
        };
        Enums: {
            message_role: "user" | "assistant" | "system";
            signal_source_type: "conversation" | "reflection" | "check_in" | "experiment";
        };
        CompositeTypes: Record<string, never>;
    };
};
