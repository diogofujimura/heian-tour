const fs = require('fs');
const logPath = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\f78dd171-abe1-4a86-ac38-22ce2edd7278\\.system_generated\\logs\\transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);

// Step 614 - pergunta chave sobre as planilhas conversarem
lines.forEach((line) => {
    try {
        const obj = JSON.parse(line);
        if (obj.step_index >= 612 && obj.step_index <= 660) {
            const source = obj.source || '';
            const content = (obj.content || '').substring(0, 800);
            if (source === 'USER_EXPLICIT' || (source === 'MODEL' && obj.type === 'PLANNER_RESPONSE')) {
                console.log(`\n[step ${obj.step_index}] [${source}]`);
                console.log(content);
                console.log('---');
            }
        }
    } catch(e) {}
});
