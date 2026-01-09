import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// https://vitejs.dev/config/
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [react()],
        define: {
            // This ensures process.env.API_KEY works in the browser for the GenAI SDK
            'process.env.API_KEY': JSON.stringify(env.API_KEY),
            // Fallback for other process.env calls if necessary
            'process.env': {}
        }
    };
});
