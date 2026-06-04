const fs = require('fs');
const logs = fs.readFileSync('.gemini/antigravity/brain/f78dd171-abe1-4a86-ac38-22ce2edd7278/.system_generated/logs/transcript.jsonl', 'utf8');
const lines = logs.split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('btnGerarRoteiro') && lines[i].includes('pdf-cover') && lines[i].includes('write_to_file')) {
        const json = JSON.parse(lines[i]);
        if (json.tool_calls && json.tool_calls[0]) {
            console.log(json.tool_calls[0].args.CodeContent.substring(0, 1500));
            break;
        }
    }
}
