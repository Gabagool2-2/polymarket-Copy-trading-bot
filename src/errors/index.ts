/**
 * Custom error classes for the copy trading bot
 */

/**
 * Base error class for the copy trading bot, providing structured error information.
 * @class BaseError
 * @extends Error
 */

export class BaseError extends Error {
    public readonly code: string;
    public readonly isRetryable: boolean;
    public readonly severity: 'low' | 'medium' | 'high' | 'critical';

    /**
     * Creates an instance of BaseError.
     * @param {string} message - The error message.
     * @param {string} code - The error code.
     * @param {boolean} [isRetryable=false] - Whether the error is retryable.
     * @param {'low' | 'medium' | 'high' | 'critical'} [severity='medium'] - The severity level.
     */
    constructor(
        message: string,
        code: string,
        isRetryable: boolean = false,
        severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
    ) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.isRetryable = isRetryable;
        this.severity = severity;
    }
}

/**
 * Error class for network-related issues.
 * @class NetworkError
 * @extends BaseError
 */

export class NetworkError extends BaseError {
    /**
     * Creates an instance of NetworkError.
     * @param {string} message - The error message.
     * @param {boolean} [isRetryable=true] - Whether the error is retryable.
     */
    constructor(message: string, isRetryable: boolean = true) {
        super(message, 'NETWORK_ERROR', isRetryable, 'medium');
    }
}

/**
 * Error class for validation failures.
 * @class ValidationError
 * @extends BaseError
 */

export class ValidationError extends BaseError {
    /**
     * Creates an instance of ValidationError.
     * @param {string} message - The error message.
     */
    constructor(message: string) {
        super(message, 'VALIDATION_ERROR', false, 'high');
    }
}

/**
 * Error class for execution failures.
 * @class ExecutionError
 * @extends BaseError
 */

export class ExecutionError extends BaseError {
    /**
     * Creates an instance of ExecutionError.
     * @param {string} message - The error message.
     * @param {boolean} [isRetryable=false] - Whether the error is retryable.
     */
    constructor(message: string, isRetryable: boolean = false) {
        super(message, 'EXECUTION_ERROR', isRetryable, 'high');
    }
}

/**
 * Error class for database-related issues.
 * @class DatabaseError
 * @extends BaseError
 */

export class DatabaseError extends BaseError {
    /**
     * Creates an instance of DatabaseError.
     * @param {string} message - The error message.
     * @param {boolean} [isRetryable=true] - Whether the error is retryable.
     */
    constructor(message: string, isRetryable: boolean = true) {
        super(message, 'DATABASE_ERROR', isRetryable, 'high');
    }
}

/**
 * Error class for API-related issues.
 * @class ApiError
 * @extends BaseError
 */

export class ApiError extends BaseError {
    /**
     * Creates an instance of ApiError.
     * @param {string} message - The error message.
     * @param {boolean} [isRetryable=true] - Whether the error is retryable.
     */
    constructor(message: string, isRetryable: boolean = true) {
        super(message, 'API_ERROR', isRetryable, 'medium');
    }
}

/**
 * Error class for insufficient funds situations.
 * @class InsufficientFundsError
 * @extends BaseError
 */

export class InsufficientFundsError extends BaseError {
    /**
     * Creates an instance of InsufficientFundsError.
     * @param {string} message - The error message.
     */
    constructor(message: string) {
        super(message, 'INSUFFICIENT_FUNDS_ERROR', false, 'critical');
    }
}

/**
 * Error class for circuit breaker activations.
 * @class CircuitBreakerError
 * @extends BaseError
 */

export class CircuitBreakerError extends BaseError {
    /**
     * Creates an instance of CircuitBreakerError.
     * @param {string} message - The error message.
     */
    constructor(message: string) {
        super(message, 'CIRCUIT_BREAKER_ERROR', true, 'high');
    }
}

/**
 * Error class for configuration issues.
 * @class ConfigurationError
 * @extends BaseError
 */

export class ConfigurationError extends BaseError {
    /**
     * Creates an instance of ConfigurationError.
     * @param {string} message - The error message.
     */
    constructor(message: string) {
        super(message, 'CONFIGURATION_ERROR', false, 'critical');
    }
}