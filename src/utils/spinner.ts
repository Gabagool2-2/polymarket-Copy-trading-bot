/**
 * Spinner utility module.
 * This module provides a configured Ora spinner for displaying loading states.
 */

import ora from 'ora';

/**
 * Configured Ora spinner instance.
 */
const spinner = ora({
    spinner: {
        interval: 200,
        frames: [
            '▰▱▱▱▱▱▱',
            '▰▰▱▱▱▱▱',
            '▰▰▰▱▱▱▱',
            '▰▰▰▰▱▱▱',
            '▰▰▰▰▰▱▱',
            '▰▰▰▰▰▰▱',
            '▰▰▰▰▰▰▰',
            '▱▱▱▱▱▱▱',
        ],
    },
});

export default spinner;
