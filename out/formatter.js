"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLFormatter = void 0;
class SQLFormatter {
    format(input) {
        const sql = input || '';
        const out = this.preserveSegments(sql, (code) => {
            let s = code;
            s = this.collapseExistingNoLock(s);
            s = this.uppercaseKeywords(s);
            s = this.formatStoredProcedureParameters(s);
            s = this.stripExistingBrackets(s);
            s = this.bracketIdentifiers(s);
            s = this.addNoLock(s);
            s = this.normalizeClauses(s);
            s = this.normalizeSpacing(s);
            s = this.cleanupIndentSimple(s);
            s = this.normalizeIdempotency(s);
            return s;
        });
        let finalOut = out.replace(/[ \t]+$/gm, '').trim();
        // Ensure block comments are followed by newline when next token is a keyword
        finalOut = finalOut.replace(/\*\/(?=\s*(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|--))/gi, '*/\n');
        // Ensure single-line comments have a leading space before the --
        finalOut = finalOut.replace(/([^ \t])(--)/g, '$1 $2');
        return finalOut;
    }
    preserveSegments(sql, transformCode) {
        const parts = [];
        let i = 0;
        const len = sql.length;
        while (i < len) {
            const ch = sql[i];
            if (ch === "'") {
                let j = i + 1;
                let buf = "'";
                while (j < len) {
                    if (sql[j] === "'") {
                        buf += "'";
                        j++;
                        if (sql[j] === "'") {
                            buf += "'";
                            j++;
                            continue;
                        }
                        break;
                    }
                    buf += sql[j++];
                }
                parts.push(buf);
                i = j;
                continue;
            }
            if (ch === '-' && sql[i + 1] === '-') {
                const j = sql.indexOf('\n', i + 2);
                if (j === -1) {
                    parts.push(sql.slice(i));
                    break;
                }
                parts.push(sql.slice(i, j));
                i = j;
                continue;
            }
            if (ch === '/' && sql[i + 1] === '*') {
                const j = sql.indexOf('*/', i + 2);
                if (j === -1) {
                    parts.push(sql.slice(i));
                    break;
                }
                parts.push(sql.slice(i, j + 2));
                i = j + 2;
                continue;
            }
            let j = i;
            while (j < len && sql[j] !== "'" && !(sql[j] === '-' && sql[j + 1] === '-') && !(sql[j] === '/' && sql[j + 1] === '*'))
                j++;
            const code = sql.slice(i, j);
            parts.push(transformCode(code));
            i = j;
        }
        return parts.join('');
    }
    uppercaseKeywords(sql) {
        const kws = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN', 'ORDER BY', 'GROUP BY', 'HAVING', 'UNION', 'UNION ALL', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'PROCEDURE', 'AS', 'ON', 'WITH', 'NOLOCK', 'TOP', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AND', 'OR', 'IN', 'IS', 'COUNT', 'INT', 'NVARCHAR'];
        kws.sort((a, b) => b.length - a.length);
        let out = sql;
        for (const k of kws) {
            const pat = new RegExp('\\b' + k.replace(/\s+/g, '\\s+') + '\\b', 'gi');
            out = out.replace(pat, k);
        }
        return out;
    }
    formatStoredProcedureParameters(sql) {
        return sql.replace(/CREATE\s+PROCEDURE\s+([^\r\n(]+)([\s\S]*?)\bAS\b/gi, (_m, name, params) => {
            const proc = (name || '').trim();
            let schema = '';
            let procName = proc;
            if (proc.includes('.')) {
                const p = proc.split('.').map((s) => s.trim());
                schema = p[0].replace(/\[|\]/g, '');
                procName = p[1].replace(/\[|\]/g, '');
            }
            else {
                // remove any surrounding brackets
                procName = procName.replace(/\[|\]/g, '');
            }
            const schemaPart = schema ? `[${this.toPascal(schema)}].` : '';
            // preserve original procName casing if it contains internal uppercase letters
            const procPartName = /[A-Z]/.test(procName.slice(1)) ? procName : this.toPascal(procName);
            const procPart = `[${procPartName}]`;
            const ptext = (params || '').trim();
            if (!ptext)
                return `CREATE PROCEDURE ${schemaPart}${procPart}\nAS`;
            const flat = ptext.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
            const parts = flat.split(',').map((p) => p.trim()).filter(Boolean);
            const formatted = parts.map((p, i) => {
                // uppercase SQL types and ensure spacing around =
                const m = p.match(/^(@?[a-zA-Z0-9_]+)\s+([a-zA-Z0-9()]+)(\s*=\s*(.*))?$/i);
                if (m) {
                    const name = m[1];
                    const type = m[2].toUpperCase();
                    const def = m[4] ? ' = ' + m[4].trim() : '';
                    return '    ' + `${name} ${type}${def}` + (i < parts.length - 1 ? ',' : '');
                }
                return '    ' + p.replace(/\s*=\s*/, ' = ') + (i < parts.length - 1 ? ',' : '');
            }).join('\n');
            return `CREATE PROCEDURE ${schemaPart}${procPart}\n${formatted}\nAS`;
        });
    }
    bracketIdentifiers(sql) {
        // Avoid changing keywords, numbers, parameters and already bracketed identifiers.
        // Do not bracket function names (followed by a parenthesis).
        // Avoid matching identifiers that are parameters (preceded by @) using negative lookbehind
        return sql.replace(/(?<!@)\b([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\b(?!\s*\()/g, (m) => {
            if (m.startsWith('@'))
                return m;
            if (this.isKeyword(m))
                return m;
            if (/^\d/.test(m))
                return m;
            if (/^\(/.test(m))
                return m;
            // strip any stray brackets that survived
            const raw = m.replace(/\[|\]/g, '');
            if (raw.includes('.')) {
                const parts = raw.split('.');
                const first = parts[0];
                const rest = parts.slice(1).map(p => `[${this.toPascal(p)}]`).join('.');
                // preserve common lowercase aliases (like u, o, c)
                if (/^[a-z][a-z0-9_]*$/.test(first) && first.length <= 2)
                    return `${first}.${rest}`;
                return parts.map(p => `[${this.toPascal(p)}]`).join('.');
            }
            // do not bracket single-letter lowercase aliases (common table aliases)
            if (raw.length === 1 && /^[a-z]$/.test(raw))
                return raw;
            return `[${this.toPascal(raw)}]`;
        });
    }
    stripExistingBrackets(sql) {
        // remove nested or multiple brackets around identifiers so reformatting is idempotent
        return sql.replace(/\[+\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\]+/g, '$1');
    }
    normalizeIdempotency(sql) {
        let s = sql;
        // collapse repeated WITH(NOLOCK)
        s = s.replace(/(?:WITH\s*\(\s*NOLOCK\s*\)\s*){2,}/gi, 'WITH(NOLOCK)');
        s = s.replace(/\bWITH\s+WITH\s*\(\s*NOLOCK\s*\)/gi, 'WITH(NOLOCK)');
        // collapse stray repeated (NOLOCK) parentheses like WITH(NOLOCK)(NOLOCK)
        s = s.replace(/\(NOLOCK\)(?:\s*\(NOLOCK\))+/gi, '(NOLOCK)');
        // collapse multiple opening/closing brackets
        s = s.replace(/\[{2,}/g, '[').replace(/\]{2,}/g, ']');
        // remove accidental adjacent duplicate bracket pairs
        s = s.replace(/\[\s*\[+/g, '[').replace(/\]+\s*\]/g, ']');
        return s;
    }
    collapseExistingNoLock(sql) {
        // collapse any pre-existing WITH(NOLOCK) duplicates before other transforms
        let s = sql;
        s = s.replace(/WITH\s*\(\s*NOLOCK\s*\)(?:\s*WITH\s*\(\s*NOLOCK\s*\))*/gi, 'WITH(NOLOCK)');
        s = s.replace(/\bWITH\s+WITH\s*\(\s*NOLOCK\s*\)/gi, 'WITH(NOLOCK)');
        return s;
    }
    addNoLock(sql) {
        // Add WITH(NOLOCK) after table references in FROM/JOIN when not present.
        return sql.replace(/\b(FROM|INNER JOIN|JOIN|LEFT JOIN|RIGHT JOIN|FULL JOIN|CROSS JOIN)\s+([^\s(]+)(?:\s+([a-zA-Z0-9_]+))?/gi, (m, op, tblRaw, alias) => {
            // if already contains WITH(NOLOCK) do nothing (idempotent)
            if (/WITH\s*\(\s*NOLOCK\s*\)/i.test(m))
                return m;
            if (/^\(/.test(tblRaw))
                return m;
            // preserve existing bracketed or dotted names
            const tbl = tblRaw.replace(/\[|\]/g, '');
            const parts = tbl.split('.');
            let mapped;
            if (parts.length === 1) {
                mapped = `[dbo].[${this.toPascal(parts[0])}]`;
            }
            else {
                mapped = parts.map(p => `[${this.toPascal(p)}]`).join('.');
            }
            const aliasPart = alias ? ' ' + alias.replace(/WITH\s*\(\s*NOLOCK\s*\)/i, '') : '';
            return `${op} ${mapped}${aliasPart} WITH(NOLOCK)`;
        });
    }
    normalizeClauses(sql) {
        let s = sql;
        s = s.replace(/\s+(INNER JOIN|LEFT JOIN|RIGHT JOIN|FULL JOIN|CROSS JOIN|JOIN)\s+/gi, '\n$1 ');
        s = s.replace(/\s+FROM\s+/gi, '\nFROM ');
        s = s.replace(/\s+WHERE\s+/gi, '\nWHERE ');
        s = s.replace(/\s+GROUP\s+BY\s+/gi, '\nGROUP BY ');
        s = s.replace(/\s+ORDER\s+BY\s+/gi, '\nORDER BY ');
        s = s.replace(/\s+UNION\s+/gi, '\nUNION\n');
        s = s.replace(/\s+VALUES\s+/gi, '\nVALUES ');
        // move ON to its own line (indent later in cleanup)
        s = s.replace(/\s+ON\s+/gi, '\nON ');
        return s;
    }
    normalizeSpacing(sql) {
        // Normalize spacing but preserve leading indentation and string/comment segments.
        const lines = sql.split('\n');
        const out = [];
        for (const line of lines) {
            const m = line.match(/^(\s*)([\s\S]*)$/);
            const indent = m ? m[1] : '';
            let body = m ? m[2] : line;
            // protect string literals inside the body
            body = body.replace(/,\s*/g, ', ');
            body = body.replace(/\s*(=|<>|!=|<=|>=|<|>)\s*/g, ' $1 ');
            body = body.replace(/[ \t]{2,}/g, ' ');
            // do not trim body to preserve space before/after string literals
            out.push(indent + body);
        }
        return out.join('\n');
    }
    cleanupIndentSimple(sql) {
        const lines = [];
        const rawLines = sql.split('\n');
        for (let ln of rawLines) {
            if (!ln.trim())
                continue;
            // preserve already-indented blocks (like proc params or inner subqueries)
            if (/^\s{4,}/.test(ln)) {
                lines.push(ln.replace(/\s+$/, ''));
                continue;
            }
            const t = ln.trim();
            const up = t.toUpperCase();
            if (up.startsWith('SELECT')) {
                const rest = t.slice(6).trim();
                let selectLine = 'SELECT';
                let cols = rest;
                const mod = cols.match(/^(DISTINCT\s+TOP\s+\d+|DISTINCT|TOP\s+\d+)/i);
                if (mod) {
                    selectLine = 'SELECT ' + mod[0].toUpperCase();
                    cols = cols.slice(mod[0].length).trim();
                }
                lines.push(selectLine);
                if (cols) {
                    if (/\(\s*SELECT\b/i.test(cols)) {
                        lines.push('    ' + cols);
                    }
                    else {
                        const parts = cols.split(',').map((s) => s.trim()).filter(Boolean);
                        if (parts.length <= 2) {
                            lines.push('    ' + parts.join(', '));
                        }
                        else {
                            for (let i = 0; i < parts.length; i++) {
                                const suffix = i < parts.length - 1 ? ',' : '';
                                lines.push('    ' + parts[i] + suffix);
                            }
                        }
                    }
                }
                continue;
            }
            if (/^(FROM|INNER JOIN|LEFT JOIN|RIGHT JOIN|FULL JOIN|CROSS JOIN|JOIN)/i.test(t)) {
                lines.push(t);
                continue;
            }
            if (/^WHERE\b/i.test(t)) {
                // split AND/OR into indented lines
                const rest = t.replace(/^WHERE\s+/i, '');
                const parts = rest.split(/\s+(AND|OR)\s+/i).filter(Boolean);
                // parts is like [cond1, 'AND', cond2, 'AND', cond3...]
                let cur = 'WHERE ' + parts[0].trim();
                lines.push(cur);
                for (let i = 1; i < parts.length; i += 2) {
                    const op = parts[i].toUpperCase();
                    const cond = parts[i + 1] ? parts[i + 1].trim() : '';
                    lines.push('    ' + op + ' ' + cond);
                }
                continue;
            }
            if (/^ON\b/i.test(t)) {
                lines.push('    ' + t);
                continue;
            }
            if (/^(AND |OR )/i.test(t)) {
                lines.push('    ' + t);
                continue;
            }
            // split SET assignments
            if (/^SET\b/i.test(t)) {
                const rhs = t.slice(3).trim();
                const parts = rhs.split(',').map(p => p.trim()).filter(Boolean);
                lines.push('SET ' + (parts.length ? parts[0] : ''));
                for (let i = 1; i < parts.length; i++)
                    lines.push('    ' + parts[i].replace(/\s*=\s*/, ' = '));
                continue;
            }
            // keep VALUES on its own line
            if (/^VALUES\b/i.test(t)) {
                lines.push(t);
                continue;
            }
            lines.push(t);
        }
        return lines.join('\n');
    }
    toPascal(s) {
        if (!s)
            return s;
        if (s.toLowerCase() === 'dbo')
            return 'dbo';
        // preserve existing mixed/camel case (do not force lowercasing) if any upper exists
        if (/[A-Z]/.test(s))
            return s;
        const cleaned = s.replace(/[^a-zA-Z0-9]+/g, ' ');
        return cleaned.split(/\s+/).map(p => p.length ? p[0].toUpperCase() + p.slice(1).toLowerCase() : '').join('');
    }
    isKeyword(w) {
        if (!w)
            return false;
        const k = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'ORDER', 'GROUP', 'BY', 'HAVING', 'AS', 'ON', 'WITH', 'NOLOCK', 'INSERT', 'UPDATE', 'DELETE', 'VALUES', 'INTO', 'PROCEDURE', 'CREATE', 'SET', 'TOP', 'DISTINCT', 'UNION', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AND', 'OR', 'IN', 'IS', 'COUNT', 'INT', 'NVARCHAR', 'DESC', 'ASC'];
        return k.includes(w.toUpperCase());
    }
}
exports.SQLFormatter = SQLFormatter;
//# sourceMappingURL=formatter.js.map