import { readFileSync, writeFileSync } from 'node:fs';
import { buildRules } from './form-rules.mjs';

const contract = JSON.parse(readFileSync('./openapi.json', 'utf8'));
writeFileSync('./src/api/rules.generated.ts', buildRules(contract.components.schemas));
console.log('Правила форм собраны: src/api/rules.generated.ts');
