// Copyright 2017-2021 @polkadot/typegen authors & contributors
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-unused-vars */

import type { TypeDef } from '@polkadot/types/create/types';
import type { Registry } from '@polkadot/types/types';

import Handlebars from 'handlebars';

import { getTypeDef, paramsNotation, sanitize } from '@polkadot/types/create';
import { TypeDefInfo } from '@polkadot/types/create/types';
import { isString, stringify } from '@polkadot/util';

import { readTemplate } from './file';
import { ModuleTypes, setImports, TypeImports } from './imports';

interface ImportDef {
  file: string;
  types: string[];
}

interface This {
  imports: TypeImports;
  types: ImportDef[];
}

const NO_CODEC = ['Tuple', 'VecFixed'];
const NO_NAMED = ['N', 'T', 'H256', 'MultiAddress', 'Vec<u8>'];

export const HEADER = (type: 'chain' | 'defs'): string => `// Auto-generated via \`yarn polkadot-types-from-${type}\`, do not edit\n/* eslint-disable */\n\n`;

Handlebars.registerPartial({
  footer: Handlebars.compile(readTemplate('footer')),
  header: Handlebars.compile(readTemplate('header'))
});

Handlebars.registerHelper({
  imports () {
    const { imports, types } = this as unknown as This;
    const defs = [
      {
        file: '@polkadot/types',
        types: [
          ...Object.keys(imports.codecTypes).filter((name) => !NO_CODEC.includes(name)),
          ...Object.keys(imports.extrinsicTypes),
          ...Object.keys(imports.genericTypes),
          ...Object.keys(imports.metadataTypes),
          ...Object.keys(imports.primitiveTypes)
        ]
      },
      {
        file: '@polkadot/types/types',
        types: Object.keys(imports.typesTypes)
      },
      ...types
    ];

    return [...defs].sort((a, b) => a.file.localeCompare(b.file)).reduce((result, { file, types }): string => {
      return types.length
        ? `${result}import type { ${types.sort().join(', ')} } from '${file}';\n`
        : result;
    }, '');
  },
  trim (options: { fn: (self: unknown) => string }) {
    return options.fn(this).trim();
  },
  upper (options: { fn: (self: unknown) => string }) {
    return options.fn(this).toUpperCase();
  }
});

// helper to generate a `export interface <Name> extends <Base> {<Body>}
/** @internal */
export function exportInterface (lookupIndex = -1, name = '', base: string, body = ''): string {
  // * @description extends [[${base}]]
  const doc = `/** @name ${name}${lookupIndex !== -1 ? ` (${lookupIndex})` : ''} */\n`;

  return `${doc}export interface ${name} extends ${base} {${body.length ? '\n' : ''}${body}}`;
}

// helper to create an `export type <Name> = <Base>`
// but since we don't want type alias (TS doesn't preserve names) we use
// interface here.
/** @internal */
export function exportType (lookupIndex = -1, name = '', base: string): string {
  return exportInterface(lookupIndex, name, base);
}

function singleParamNotation (registry: Registry, wrapper: string, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string): string {
  const sub = (typeDef.sub as TypeDef);

  setImports(definitions, imports, [wrapper, sub.lookupName]);

  return paramsNotation(wrapper, sub.lookupName || formatType(registry, definitions, sub.type, imports, withShortcut, typeName));
}

function dualParamsNotation (registry: Registry, wrapper: string, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean): string {
  const [a, b] = (typeDef.sub as TypeDef[]);

  setImports(definitions, imports, [wrapper, a.lookupName, b.lookupName]);

  return paramsNotation(wrapper, [
    a.lookupName || formatType(registry, definitions, a.type, imports, withShortcut),
    b.lookupName || formatType(registry, definitions, b.type, imports, withShortcut)
  ]);
}

export function createNamed (definitions: Record<string, ModuleTypes>, imports: TypeImports, type: string, typeName?: string): string {
  if (!typeName || NO_NAMED.includes(type) || typeName.startsWith('(') || typeName.startsWith('[') || typeName.startsWith('Vec<')) {
    return type;
  }

  typeName = sanitize(typeName);

  if (type.includes(typeName) || NO_NAMED.includes(typeName)) {
    return type;
  }

  setImports(definitions, imports, ['As']);

  return `As<'${typeName}', ${type}>`;
}

const formatters: Record<TypeDefInfo, (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => string> = {
  [TypeDefInfo.Compact]: (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    return singleParamNotation(registry, 'Compact', typeDef, definitions, imports, withShortcut, typeName);
  },

  [TypeDefInfo.DoNotConstruct]: (registry: Registry, { lookupName }: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    setImports(definitions, imports, ['DoNotConstruct']);

    return 'DoNotConstruct';
  },

  [TypeDefInfo.Enum]: (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    if (typeDef.lookupName) {
      return typeDef.lookupName;
    }

    throw new Error(`TypeDefInfo.Enum: Not implemented on ${stringify(typeDef)}`);
  },

  [TypeDefInfo.Int]: (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    throw new Error(`TypeDefInfo.Int: Not implemented on ${stringify(typeDef)}`);
  },

  [TypeDefInfo.UInt]: (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    throw new Error(`TypeDefInfo.UInt: Not implemented on ${stringify(typeDef)}`);
  },

  [TypeDefInfo.Null]: (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    setImports(definitions, imports, ['Null']);

    return 'Null';
  },

  [TypeDefInfo.Option]: (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    if (typeName) {
      typeName = typeName.replace(/^Option<(.*)>$/, '$1');
    }

    return singleParamNotation(registry, 'Option', typeDef, definitions, imports, withShortcut, typeName);
  },

  [TypeDefInfo.Plain]: (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    setImports(definitions, imports, [typeDef.type]);

    return createNamed(definitions, imports, typeDef.type, typeName);
  },

  [TypeDefInfo.Range]: (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    throw new Error(`TypeDefInfo.Range: Not implemented on ${stringify(typeDef)}`);
  },

  [TypeDefInfo.Set]: (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    throw new Error(`TypeDefInfo.Set: Not implemented on ${stringify(typeDef)}`);
  },

  [TypeDefInfo.Si]: (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    return formatType(registry, definitions, registry.lookup.getTypeDef(typeDef.type), imports, withShortcut);
  },

  [TypeDefInfo.Struct]: (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    if (typeDef.lookupName) {
      return typeDef.lookupName;
    }

    const sub = typeDef.sub as TypeDef[];

    setImports(definitions, imports, ['Struct', ...sub.map(({ lookupName }) => lookupName)]);

    return `{${withShortcut ? ' ' : '\n'}${
      sub.map(({ lookupName, name, type, typeName }, index) => [
        name || `unknown${index}`,
        lookupName
          ? createNamed(definitions, imports, lookupName, typeName)
          : formatType(registry, definitions, type, imports, withShortcut, typeName)
      ]).map(([k, t, n]) => `${withShortcut ? '' : '    readonly '}${k}: ${t};`).join(withShortcut ? ' ' : '\n')
    }${withShortcut ? ' ' : '\n  '}} & Struct`;
  },

  [TypeDefInfo.Tuple]: (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    const sub = typeDef.sub as TypeDef[];

    setImports(definitions, imports, ['ITuple', ...sub.map(({ lookupName }) => lookupName)]);

    // `(a,b)` gets transformed into `ITuple<[a, b]>`
    return paramsNotation('ITuple', `[${
      sub.map(({ lookupName, type, typeName }) =>
        lookupName
          ? createNamed(definitions, imports, lookupName, typeName)
          : formatType(registry, definitions, type, imports, withShortcut, typeName)
      ).join(', ')
    }]`);
  },

  [TypeDefInfo.Vec]: (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    return singleParamNotation(registry, 'Vec', typeDef, definitions, imports, withShortcut);
  },

  [TypeDefInfo.VecFixed]: (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    const sub = (typeDef.sub as TypeDef);

    if (sub.type === 'u8') {
      setImports(definitions, imports, ['U8aFixed']);

      return 'U8aFixed';
    }

    return singleParamNotation(registry, 'Vec', typeDef, definitions, imports, withShortcut);
  },

  [TypeDefInfo.BTreeMap]: (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    return dualParamsNotation(registry, 'BTreeMap', typeDef, definitions, imports, withShortcut);
  },

  [TypeDefInfo.BTreeSet]: (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    return singleParamNotation(registry, 'BTreeSet', typeDef, definitions, imports, withShortcut);
  },

  [TypeDefInfo.HashMap]: (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    return dualParamsNotation(registry, 'HashMap', typeDef, definitions, imports, withShortcut);
  },

  [TypeDefInfo.Linkage]: (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    return singleParamNotation(registry, 'Linkage', typeDef, definitions, imports, withShortcut);
  },

  [TypeDefInfo.Result]: (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    return dualParamsNotation(registry, 'Result', typeDef, definitions, imports, withShortcut);
  },

  [TypeDefInfo.WrapperOpaque]: (registry: Registry, typeDef: TypeDef, definitions: Record<string, ModuleTypes>, imports: TypeImports, withShortcut: boolean, typeName?: string) => {
    return singleParamNotation(registry, 'WrapperOpaque', typeDef, definitions, imports, withShortcut);
  }
};

/**
 * Correctly format a given type
 */
/** @internal */
// eslint-disable-next-line @typescript-eslint/ban-types
export function formatType (registry: Registry, definitions: Record<string, ModuleTypes>, type: string | String | TypeDef, imports: TypeImports, withShortcut = false, typeName?: string): string {
  let typeDef: TypeDef;

  if (isString(type)) {
    const _type = type.toString();

    // If type is "unorthodox" (i.e. `{ something: any }` for an Enum input or `[a | b | c, d | e | f]` for a Tuple's similar types),
    // we return it as-is
    if (withShortcut && /(^{.+:.+})|^\([^,]+\)|^\(.+\)\[\]|^\[.+\]/.exec(_type) && !/\[\w+;\w+\]/.exec(_type)) {
      return _type;
    }

    typeDef = getTypeDef(type);
  } else {
    typeDef = type;
  }

  setImports(definitions, imports, [typeDef.lookupName || typeDef.type]);

  return formatters[typeDef.info](registry, typeDef, definitions, imports, withShortcut, typeName);
}
