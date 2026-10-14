import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const requireDependency = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Compile the actual handlers and helpers, replacing only the database client.
export function load(relative, client, overrides = {}) {
    const cache = new Map();
    function read(filename) {
        if (cache.has(filename)) return cache.get(filename).exports;
        const result = { exports: {} };
        cache.set(filename, result);
        const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
        }).outputText;
        const localRequire = name => {
            if (Object.hasOwn(overrides, name)) return overrides[name];
            if (name === '@/utils/supabase/server') return { createClient: async () => client };
            if (name.startsWith('@/')) return read(path.join(root, name.slice(2)) + '.ts');
            if (name.startsWith('.')) return read(path.resolve(path.dirname(filename), name) + '.ts');
            return requireDependency(name);
        };
        vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(localRequire, result, result.exports);
        return result.exports;
    }
    return read(path.join(root, relative));
}

