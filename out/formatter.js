"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLFormatter = void 0;
class SQLFormatter {
    format(sql) {
        let s = sql || '';
        s = this.normalizeSpacing(s);
        s = this.formatAllKeywords(s);
        s = this.formatStoredProcedureParameters(s);
        s = this.formatStoredProcedures(s);
        s = this.formatVariables(s);
        s = this.formatAllIdentifiers(s);
        s = s.replace(/DECIMAL\s*\(\s*\d+\s*,\s*\d+\s*\)/gi, 'DECIMAL(19,6)');
        s = this.cleanupAndIndent(s);
        return s;
    }
    formatAllKeywords(sql) {
        const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AS', 'AND', 'OR', 'NOT', 'IN', 'VALUES', 'SET', 'CREATE', 'PROCEDURE', 'DECLARE', 'BEGIN', 'END', 'INSERT', 'UPDATE', 'DELETE'];
        keywords.sort((a, b) => b.length - a.length);
        let out = sql;
        for (const k of keywords) {
            const r = new RegExp('\\\b' + k.replace(/\\s+/g, '\\\s+') + '\\b', 'gi');
            out = out.replace(r, k.toUpperCase());
        }
        return out;
    }
    formatStoredProcedureParameters(sql) {
        return sql.replace(/(CREATE\s+PROCEDURE\s+[^\r\n(]+)([\s\S]*?)\bAS\b/gi, (_m, header, params) => {
            const raw = (params || '').trim();
            if (!raw)
                return header + '\nAS';
            const flat = raw.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
            const parts = flat.split(',').map(p => p.trim()).filter(Boolean);
            const block = parts.map((p, i) => '\t' + p + (i < parts.length - 1 ? ',' : '')).join('\n');
            return header + '\n' + block + '\nAS';
        });
    }
    formatStoredProcedures(sql) {
        let out = sql.replace(/SET\s+\[?NOCOUNT\]?\s+ON;?/gi, 'SET NOCOUNT ON;');
        out = out.replace(/(?:\bSET NOCOUNT ON;?\s*){2,}/gi, 'SET NOCOUNT ON;\n');
        return out;
    }
    formatVariables(sql) {
        return sql.replace(/@([A-Z][a-zA-Z0-9_]*)/g, (_m, name) => '@' + name.charAt(0).toLowerCase() + name.slice(1));
    }
    formatAllIdentifiers(sql) {
        let out = sql.replace(/\[+\s*([^\[\]]+?)\s*\]+/g, '[$1]');
        out = out.replace(/@\[([^\]]+)\]/g, '@$1');
        return out;
    }
    normalizeSpacing(sql) {
        let out = sql.replace(/,\s*/g, ', ');
        out = out.replace(/\s*(=|<>|!=|<=|>=|<|>)\s*/g, ' $1 ');
        out = out.replace(/ {2,}/g, ' ');
        return out.split('\n').map(l => l.replace(/\s+$/, '')).join('\n');
    }
    cleanupAndIndent(sql) {
        const lines = sql.split('\n').map(l => l.trim()).filter(Boolean);
        const out = [];
        for (const line of lines) {
            const up = line.toUpperCase();
            if (/^SELECT\b/i.test(up)) {
                const m = line.match(/^SELECT\s*(.*)$/i);
                out.push('SELECT');
                if (m && m[1].trim()) {
                    const cols = m[1].split(',').map(c => c.trim()).filter(Boolean);
                    out.push('\t' + cols.join(', '));
                }
                continue;
            }
            out.push(line);
        }
        return out.join('\n');
    }
    splitConditions(whereClause) {
        const toks = whereClause.split(/\b(AND|OR)\b/i);
        if (toks.length <= 2)
            return [whereClause];
        const res = [toks[0].trim()];
        for (let i = 1; i < toks.length; i += 2) {
            const op = toks[i].trim().toUpperCase();
            const cond = (toks[i + 1] || '').trim();
            if (cond)
                res.push(`${op} ${cond}`);
        }
        return res;
    }
    isKeyword(word) {
        const k = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'ON', 'AS', 'AND', 'OR', 'NOT', 'IN', 'VALUES', 'SET', 'CREATE', 'PROCEDURE', 'BEGIN', 'END'];
        return k.indexOf((word || '').toUpperCase()) >= 0;
    }
}
exports.SQLFormatter = SQLFormatter;
//# sourceMappingURL=formatter.js.map