// Generated from contracts/learning.openapi.json. Do not edit.
// Contract SHA256: 23841a07b6bb212c6742194dd12cb81b420192c64c3d752f84d578d5c82cb0d2
export interface paths {
    "/schools/{schoolId}/attempts/{attemptId}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                attemptId: components["parameters"]["Attempt"];
                schoolId: components["parameters"]["School"];
            };
            cookie?: never;
        };
        /** @description Student-owned attempt only. If expired, server finalizes exactly once before returning submitted state. All timestamps are integer Unix milliseconds in UTC; serverTime is authoritative. */
        get: operations["getAttempt"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/schools/{schoolId}/attempts/{attemptId}/answers/{questionId}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                attemptId: components["parameters"]["Attempt"];
                questionId: components["parameters"]["Question"];
                schoolId: components["parameters"]["School"];
            };
            cookie?: never;
        };
        get?: never;
        /** @description Student-owned active attempt only. Check question belongs to frozen attempt and option belongs to question. Atomically compare expectedRevision, save and increment revision. Reject late writes, finalize timeout and return 409; accepted answers remain intact. Replay lookup precedes revision comparison, within current authorization. */
        put: operations["saveAnswer"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/schools/{schoolId}/attempts/{attemptId}/submit": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                attemptId: components["parameters"]["Attempt"];
                schoolId: components["parameters"]["School"];
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** @description Student-owned attempt only. Grade saved answers atomically using server-only grading data and frozen exam version. Compare expectedRevision for active attempt. At or after deadline reason is timeout. Already submitted returns immutable result. Request cannot carry grades or bulk replacement answers. */
        post: operations["submitAttempt"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/schools/{schoolId}/exams/{examId}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                examId: components["parameters"]["Exam"];
                schoolId: components["parameters"]["School"];
            };
            cookie?: never;
        };
        /** @description Student must be enrolled and assigned this published exam. Cross-school or unowned resources return 404. Never serialize internal question or grading records directly. */
        get: operations["getStudentExam"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/schools/{schoolId}/exams/{examId}/attempts": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                examId: components["parameters"]["Exam"];
                schoolId: components["parameters"]["School"];
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** @description Student only; ownership is derived from identity. Atomically enforce assignment, exam window and retake policy. Server clock sets deadline. Existing active attempt is returned rather than replaced. No client timestamps or retake override accepted. */
        post: operations["startAttempt"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/schools/{schoolId}/guardian/children/{childId}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                childId: components["schemas"]["Id"];
                schoolId: components["parameters"]["School"];
            };
            cookie?: never;
        };
        /** @description Read a linked child using the verified guardian identity and school membership. */
        get: operations["getGuardianChild"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Resolve verified OIDC subject to application user and current database memberships. Never trust client-selected roles or stale token school claims. */
        get: operations["getSession"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        ActiveAttempt: {
            answers: components["schemas"]["SavedAnswer"][];
            deadline: components["schemas"]["Time"];
            exam?: components["schemas"]["StudentExam"];
            examId: components["schemas"]["Id"];
            id: components["schemas"]["Id"];
            revision: components["schemas"]["Revision"];
            serverTime: components["schemas"]["Time"];
            /** @constant */
            status: "active";
        };
        AnswerWrite: {
            expectedRevision: components["schemas"]["Revision"];
            optionId: components["schemas"]["Id"];
        };
        Error: {
            /** @enum {string} */
            code: "invalid_request" | "unauthenticated" | "forbidden" | "not_found" | "revision_conflict" | "attempt_closed" | "idempotency_conflict" | "rate_limited" | "unavailable";
            message: string;
            requestId: components["schemas"]["Id"];
        };
        GuardianChild: {
            childId: components["schemas"]["Id"];
            schoolId: components["schemas"]["Id"];
        };
        Id: string;
        Membership: {
            roles: ("student" | "teacher" | "guardian" | "school-admin")[];
            schoolId: components["schemas"]["Id"];
        };
        Option: {
            id: components["schemas"]["Id"];
            text: string;
        };
        Revision: number;
        SavedAnswer: {
            optionId: components["schemas"]["Id"];
            questionId: components["schemas"]["Id"];
        };
        Session: {
            memberships: components["schemas"]["Membership"][];
            serverTime: components["schemas"]["Time"];
            userId: components["schemas"]["Id"];
        };
        StudentExam: {
            durationSeconds: number;
            id: components["schemas"]["Id"];
            questions: components["schemas"]["StudentQuestion"][];
            title: string;
        };
        StudentQuestion: {
            id: components["schemas"]["Id"];
            options: components["schemas"]["Option"][];
            text: string;
        };
        SubmittedAttempt: {
            answers: components["schemas"]["SavedAnswer"][];
            deadline: components["schemas"]["Time"];
            examId: components["schemas"]["Id"];
            id: components["schemas"]["Id"];
            /** @enum {string} */
            reason: "manual" | "timeout";
            revision: components["schemas"]["Revision"];
            score: number;
            serverTime: components["schemas"]["Time"];
            /** @constant */
            status: "submitted";
            submittedAt: components["schemas"]["Time"];
            total: number;
        };
        SubmitWrite: {
            expectedRevision: components["schemas"]["Revision"];
        };
        /** Format: int64 */
        Time: number;
    };
    responses: {
        /** @description Structured error; no internal details or cross-school existence disclosure. 401 invalid identity, 403 forbidden role, 404 absent or unowned, 409 revision/state/idempotency conflict. */
        Error: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
    };
    parameters: {
        Attempt: components["schemas"]["Id"];
        Exam: components["schemas"]["Id"];
        /** @description Unique write UUID. Bind key to school, user, operation, resource and normalized payload hash. Persist response atomically with write for at least 24h; same key and payload replays stored status/body, changed payload returns 409. Authorization is rechecked on every replay. Expired keys do not bypass attempt state or deadline checks. */
        Idempotency: components["schemas"]["Id"];
        Question: components["schemas"]["Id"];
        School: components["schemas"]["Id"];
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getAttempt: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                attemptId: components["parameters"]["Attempt"];
                schoolId: components["parameters"]["School"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Current server state */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActiveAttempt"] | components["schemas"]["SubmittedAttempt"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
            default: components["responses"]["Error"];
        };
    };
    saveAnswer: {
        parameters: {
            query?: never;
            header: {
                /** @description Unique write UUID. Bind key to school, user, operation, resource and normalized payload hash. Persist response atomically with write for at least 24h; same key and payload replays stored status/body, changed payload returns 409. Authorization is rechecked on every replay. Expired keys do not bypass attempt state or deadline checks. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                attemptId: components["parameters"]["Attempt"];
                questionId: components["parameters"]["Question"];
                schoolId: components["parameters"]["School"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AnswerWrite"];
            };
        };
        responses: {
            /** @description Authoritative updated state */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActiveAttempt"];
                };
            };
            400: components["responses"]["Error"];
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
            409: components["responses"]["Error"];
            429: components["responses"]["Error"];
            default: components["responses"]["Error"];
        };
    };
    submitAttempt: {
        parameters: {
            query?: never;
            header: {
                /** @description Unique write UUID. Bind key to school, user, operation, resource and normalized payload hash. Persist response atomically with write for at least 24h; same key and payload replays stored status/body, changed payload returns 409. Authorization is rechecked on every replay. Expired keys do not bypass attempt state or deadline checks. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                attemptId: components["parameters"]["Attempt"];
                schoolId: components["parameters"]["School"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SubmitWrite"];
            };
        };
        responses: {
            /** @description Immutable result without answer keys */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SubmittedAttempt"];
                };
            };
            400: components["responses"]["Error"];
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
            409: components["responses"]["Error"];
            429: components["responses"]["Error"];
            default: components["responses"]["Error"];
        };
    };
    getStudentExam: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                examId: components["parameters"]["Exam"];
                schoolId: components["parameters"]["School"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Public questions without grading keys */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StudentExam"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
            default: components["responses"]["Error"];
        };
    };
    startAttempt: {
        parameters: {
            query?: never;
            header: {
                /** @description Unique write UUID. Bind key to school, user, operation, resource and normalized payload hash. Persist response atomically with write for at least 24h; same key and payload replays stored status/body, changed payload returns 409. Authorization is rechecked on every replay. Expired keys do not bypass attempt state or deadline checks. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                examId: components["parameters"]["Exam"];
                schoolId: components["parameters"]["School"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Existing active attempt or idempotent replay */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActiveAttempt"];
                };
            };
            /** @description Created attempt */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActiveAttempt"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
            409: components["responses"]["Error"];
            429: components["responses"]["Error"];
            default: components["responses"]["Error"];
        };
    };
    getGuardianChild: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                childId: components["schemas"]["Id"];
                schoolId: components["parameters"]["School"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Linked child */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GuardianChild"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
            default: components["responses"]["Error"];
        };
    };
    getSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Verified identity and memberships */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Session"];
                };
            };
            401: components["responses"]["Error"];
            403: components["responses"]["Error"];
            404: components["responses"]["Error"];
            default: components["responses"]["Error"];
        };
    };
}
