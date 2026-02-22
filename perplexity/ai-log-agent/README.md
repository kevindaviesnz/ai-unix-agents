# AI Unix Log Analyzer

## Setup
1. `npm install`
2. Set .env keys
3. `npm start "Find top error-causing IPs"`

## Example Run
$ npm start "Analyze errors in nginx.log"
--- Iteration 1 ---
Reason: Find errors with grep -i error
Observation: 45 error lines...
--- Iteration 2 ---
Reason: Count top IPs: awk '{print $2}' | sort | uniq -c | sort -nr
Final: Top IP 192.168.1.100: 23 errors [web:5]

Dry-run: npm start --dry-run
