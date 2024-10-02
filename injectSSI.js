const fs = require('fs');
const path = require('path');

/**
 * Replace SSI include directives with actual file contents recursively.
 * @param {string} filePath - Path to the current HTML file being processed.
 * @param {string} rootDir - Root directory for resolving paths.
 * @param {Set<string>} processedFiles - Set to track processed files and prevent circular includes.
 * @returns {string} - Processed HTML content with SSI includes replaced.
 */
function processFile(filePath, rootDir, processedFiles = new Set()) {
    const absoluteFilePath = path.resolve(filePath);

    if (processedFiles.has(absoluteFilePath)) {
        console.error(`Circular include detected: ${absoluteFilePath}`);
        process.exit(1);
    }

    if (!fs.existsSync(absoluteFilePath)) {
        console.error(`File not found: ${absoluteFilePath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(absoluteFilePath, 'utf8');

    processedFiles.add(absoluteFilePath);

    // Regular expression to match <!--#include virtual="path/to/file"-->
    // Handles various whitespace characters between tokens
    const includeRegex = /<!--\s*#include\s+virtual\s*=\s*"([^"]+)"\s*-->/gi;

    const processedContent = content.replace(includeRegex, (match, includePath) => {
        const absoluteIncludePath = includePath.startsWith('/')
            ? path.resolve(rootDir, `.${includePath}`) // Treat "/path" as "./path"
            : path.resolve(rootDir, includePath); // For regular relative paths

        if (!fs.existsSync(absoluteIncludePath)) {
            console.error(`Included file not found: ${absoluteIncludePath}`);
            process.exit(1);
        }

        // Recursively process the included file
        return processFile(absoluteIncludePath, rootDir, processedFiles);
    });

    processedFiles.delete(absoluteFilePath);

    return processedContent;
}

/**
 * Ensure that the directory for the given file path exists.
 * @param {string} filePath - The file path for which to ensure directory existence.
 */
function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);

    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}

/**
 * Main function to execute the script.
 */
function main() {
    const args = process.argv.slice(2);

    if (args.length !== 2) {
        console.error('Usage: node injectSSI.js <input_directory> <output_directory>');
        process.exit(1);
    }

    const inputDir = path.resolve(args[0]);
    const outputDir = path.resolve(args[1]);

    if (!fs.existsSync(inputDir) || !fs.statSync(inputDir).isDirectory()) {
        console.error('The provided input path is not a valid directory.');
        process.exit(1);
    }

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const indexFilePath = path.join(inputDir, 'index.html');

    if (!fs.existsSync(indexFilePath)) {
        console.error('index.html file not found in the provided directory.');
        process.exit(1);
    }

    const indexFiles = [ indexFilePath ];

    indexFiles.forEach(filePath => {
    // Determine the relative path from the input directory
        const relativePath = path.relative(inputDir, filePath);
        const outputFilePath = path.join(outputDir, relativePath);

        // Process the file by replacing SSI includes recursively
        const processedContent = processFile(filePath, inputDir);

        // Ensure the output directory exists
        ensureDirectoryExistence(outputFilePath);

        // Write the processed content to the output file
        fs.writeFileSync(outputFilePath, processedContent, 'utf8');
        console.log(`Processed and wrote to: ${outputFilePath}`);
    });

    console.log('SSI injection completed successfully.');
}

// Execute the main function
main();
