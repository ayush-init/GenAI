import { GoogleGenAI, Type } from "@google/genai";
import { exec } from "child_process";
import readlineSync from 'readline-sync';
import 'dotenv/config';
import util from "util";
import os from 'os';
import fs from 'fs/promises';
import path from 'path';

const platform = os.platform();
const execPromise = util.promisify(exec);

// Initialize Gemini Client

const ai = new GoogleGenAI({});

// ==========================================
// TOOL IMPLEMENTATIONS
// ==========================================

async function executeCommand({ command, cwd }) {
    try {
        const options = {
            shell: platform === 'win32' ? 'powershell.exe' : true,
            maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            cwd: cwd || process.cwd(),
        };
        const { stdout, stderr } = await execPromise(command, options);
        let output = "";
        if (stdout && stdout.trim()) {
            output += `[stdout]\n${stdout.trim()}\n`;
        }
        if (stderr && stderr.trim()) {
            output += `[stderr]\n${stderr.trim()}\n`;
        }
        return output || "Command executed successfully with no output.";
    } catch (err) {
        let errorMsg = `Command failed with error:\n${err.message}`;
        if (err.stdout) errorMsg += `\n[stdout]\n${err.stdout}`;
        if (err.stderr) errorMsg += `\n[stderr]\n${err.stderr}`;
        return errorMsg;
    }
}

async function writeFile({ filePath, content }) {
    try {
        const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(process.cwd(), filePath);
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, content, 'utf-8');
        return `Successfully wrote ${Buffer.byteLength(content, 'utf-8')} bytes to file: ${filePath}`;
    } catch (err) {
        return `Error writing file ${filePath}: ${err.message}`;
    }
}

async function readFile({ filePath }) {
    try {
        const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(process.cwd(), filePath);
        const content = await fs.readFile(absolutePath, 'utf-8');
        return content;
    } catch (err) {
        return `Error reading file ${filePath}: ${err.message}`;
    }
}

async function listDirectory({ dirPath }) {
    try {
        const targetPath = dirPath
            ? (path.isAbsolute(dirPath) ? dirPath : path.resolve(process.cwd(), dirPath))
            : process.cwd();
        const items = await fs.readdir(targetPath, { withFileTypes: true });
        const result = items.map(item => `${item.isDirectory() ? '[DIR] ' : '[FILE]'} ${item.name}`);
        return result.join('\n') || "Directory is empty.";
    } catch (err) {
        return `Error listing directory ${dirPath || '.'}: ${err.message}`;
    }
}

// ==========================================
// TOOL DECLARATIONS FOR GEMINI
// ==========================================

const commandExecuterDecl = {
    name: "executeCommand",
    description: "Execute a shell command in the terminal (PowerShell on Windows, Bash/Sh on macOS/Linux). Use this for terminal commands, running npm scripts, installing packages, git operations, or running servers.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            command: {
                type: Type.STRING,
                description: "The shell command to run."
            },
            cwd: {
                type: Type.STRING,
                description: "Optional directory path to execute the command from."
            }
        },
        required: ["command"]
    }
};

const writeFileDecl = {
    name: "writeFile",
    description: "Create or overwrite a file with complete text content. ALWAYS prefer this tool over terminal echo/cat for writing HTML, CSS, JavaScript, JSON, or markdown files to avoid shell escaping issues.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            filePath: {
                type: Type.STRING,
                description: "Relative or absolute path of the file to write (e.g. 'calculator/index.html')."
            },
            content: {
                type: Type.STRING,
                description: "The full string content to write into the file."
            }
        },
        required: ["filePath", "content"]
    }
};

const readFileDecl = {
    name: "readFile",
    description: "Read the text content of a file from disk.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            filePath: {
                type: Type.STRING,
                description: "Relative or absolute file path to read."
            }
        },
        required: ["filePath"]
    }
};

const listDirectoryDecl = {
    name: "listDirectory",
    description: "List files and directories in a given folder.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            dirPath: {
                type: Type.STRING,
                description: "Optional directory path to list (defaults to current directory)."
            }
        }
    }
};

// ==========================================
// SYSTEM INSTRUCTIONS & CONTEXT
// ==========================================

const SYSTEM_INSTRUCTION = `
You are an expert AI Full-Stack Website Builder Agent.

Your primary goal is to build complete, modern, fully functional, and visually stunning web applications and websites based on user requests.

Current Environment Details:
- Operating System: ${platform}
- Current Working Directory: ${process.cwd()}

========================
AVAILABLE TOOLS
========================

1. writeFile({ filePath, content }):
   - ALWAYS use this tool to write file content (HTML, CSS, JavaScript, JSON, README, etc.).
   - NEVER use shell commands like 'echo' or 'cat' to write multi-line files. 'writeFile' is 100% safe from syntax escaping issues.

2. executeCommand({ command, cwd }):
   - Use this to run shell commands (e.g. creating directories, installing npm packages, running build scripts).

3. readFile({ filePath }):
   - Use this to inspect existing file contents.

4. listDirectory({ dirPath }):
   - Use this to list files in a folder.

========================
DESIGN & QUALITY GUIDELINES
========================

- Create visually impressive, modern, premium-looking UI/UX designs.
- Use clean semantic HTML5.
- Write modern responsive CSS (flexbox, grid, CSS variables, Google Fonts like Inter/Outfit, gradients, smooth transitions, dark mode styling).
- Write clean, interactive Vanilla JavaScript (or modern framework files if specifically requested).
- Build fully working web apps without placeholder logic or broken buttons.
- Create all required files (index.html, styles.css, script.js, etc.) inside an appropriately named project directory unless directed otherwise.

========================
WORKFLOW
========================

1. Analyze user request and determine project directory & file layout.
2. Create project folder if needed using executeCommand or writeFile.
3. Use 'writeFile' to create index.html, styles.css, script.js, and other required assets.
4. Verify created files if necessary using listDirectory or readFile.
5. Once all files and code are completely written and verified, provide a short completion response summarizing what was built and how the user can view/run it.
`;

// ==========================================
// AGENT CHAT LOOP
// ==========================================

const History = [];

async function buildWebsite() {
    let turnCount = 0;
    const maxTurns = 30;

    while (turnCount < maxTurns) {
        turnCount++;

        let response;
        try {
            response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: History,
                config: {
                    systemInstruction: SYSTEM_INSTRUCTION,
                    tools: [
                        {
                            functionDeclarations: [
                                commandExecuterDecl,
                                writeFileDecl,
                                readFileDecl,
                                listDirectoryDecl
                            ]
                        }
                    ]
                }
            });
        } catch (err) {
            console.error("\n❌ API Request Error:", err.message);
            break;
        }

        const functionCalls = response.functionCalls;

        if (functionCalls && functionCalls.length > 0) {
            // Record model turn in conversation history
            History.push({
                role: "model",
                parts: functionCalls.map(fc => ({ functionCall: fc }))
            });

            const responseParts = [];

            for (const call of functionCalls) {
                const { name, args } = call;
                console.log(`\n Executing Tool: ${name}`);

                let toolResult;
                try {
                    if (name === "executeCommand") {
                        console.log(`   Command: ${args.command}`);
                        toolResult = await executeCommand(args);
                    } else if (name === "writeFile") {
                        console.log(`   File: ${args.filePath}`);
                        toolResult = await writeFile(args);
                    } else if (name === "readFile") {
                        console.log(`   File: ${args.filePath}`);
                        toolResult = await readFile(args);
                    } else if (name === "listDirectory") {
                        console.log(`   Dir: ${args.dirPath || '.'}`);
                        toolResult = await listDirectory(args);
                    } else {
                        toolResult = `Unknown tool: ${name}`;
                    }
                } catch (err) {
                    toolResult = `Execution error: ${err.message}`;
                }

                console.log(`   Response: ${toolResult.slice(0, 150)}${toolResult.length > 150 ? '...' : ''}`);

                responseParts.push({
                    functionResponse: {
                        name: name,
                        response: { result: toolResult }
                    }
                });
            }

            // Send tool responses back to history as user role
            History.push({
                role: "user",
                parts: responseParts
            });
        } else {
            // Model finished turn with a final text message
            const finalMessage = response.text || "Website build completed successfully!";
            console.log(`\n Agent Response:\n${finalMessage}\n`);

            History.push({
                role: "model",
                parts: [{ text: finalMessage }]
            });

            break;
        }
    }
}

// ==========================================
// REPL INTERACTIVE CLI
// ==========================================

async function main() {
    console.log("==================================================");
    console.log(" AI Website Builder Agent Ready!");
    console.log("   Type your website request below (or 'exit' to quit).");
    console.log("==================================================\n");

    while (true) {
        const question = readlineSync.question("Ask me anything --> ");

        if (!question || question.trim().toLowerCase() === 'exit' || question.trim().toLowerCase() === 'quit') {
            console.log("\n Exiting AI Website Builder Agent. Goodbye!");
            break;
        }

        History.push({
            role: 'user',
            parts: [{ text: question }]
        });

        await buildWebsite();
    }
}

main().catch(err => {
    console.error("Fatal Error:", err);
});
