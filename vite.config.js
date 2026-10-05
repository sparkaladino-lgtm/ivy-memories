import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default {
    root: "src/", // Sources files (typically where index.html is)
    base: "./", // Ensure relative paths in production
    publicDir: "../public/", // Path from "root" to static assets (files that are served as they are)
    server: {
        host: true, // Open to local network and display URL
        open: !(
            "SANDBOX_URL" in process.env || "CODESANDBOX_HOST" in process.env
        ), // Open if it's not a CodeSandbox
    },
    build: {
        outDir: "../dist", // Output in the dist/ folder
        emptyOutDir: true, // Empty the folder first
        sourcemap: true, // Add sourcemap
        rollupOptions: {
            input: {
                main: resolve(__dirname, "src/index.html"),
                gallery: resolve(__dirname, "src/gallery.html"),
            },
        },
    },
};
