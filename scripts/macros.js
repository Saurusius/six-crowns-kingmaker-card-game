import { MODULE_ID, MODULE_TITLE } from "./constants.js";

function escapeMacroString(value) {
  return JSON.stringify(String(value ?? ""));
}

export function buildModuleMacroCommand(method, label) {
  const methodName = String(method ?? "").trim();
  const actionLabel = String(label ?? methodName ?? "action").trim() || "action";
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(methodName)) {
    throw new Error(`Nom de méthode de macro invalide : ${methodName}`);
  }

  return `const moduleEntry = game.modules.get(${escapeMacroString(MODULE_ID)});\nconst moduleApi = moduleEntry?.api ?? globalThis.SixCrownsCardGame;\nif (!moduleEntry?.active || !moduleApi || typeof moduleApi.${methodName} !== "function") {\n  ui.notifications.error("Le module « ${MODULE_TITLE} » n’est pas chargé. Activez-le puis rechargez le monde.");\n} else {\n  try {\n    await moduleApi.${methodName}();\n  } catch (error) {\n    console.error("${MODULE_TITLE} | Échec de la macro ${actionLabel}", error);\n    ui.notifications.error(error?.message ?? "Impossible d’exécuter la macro ${actionLabel}.");\n  }\n}`;
}

function findExistingMacro(name) {
  return game.macros?.getName?.(name)
    ?? game.macros?.find?.((macro) => macro.name === name)
    ?? null;
}

function getMacroDocumentClass() {
  return globalThis.CONFIG?.Macro?.documentClass
    ?? globalThis.foundry?.documents?.Macro
    ?? globalThis.Macro
    ?? null;
}

export async function upsertModuleMacro(definition) {
  if (!game.user?.isGM) return null;

  const existing = findExistingMacro(definition.name);
  const limited = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.LIMITED ?? 1;
  const data = {
    name: definition.name,
    type: "script",
    scope: "global",
    img: definition.img,
    command: definition.command,
    ownership: {
      ...(existing?.ownership ?? {}),
      default: limited
    }
  };

  if (existing) return existing.update(data);

  const MacroClass = getMacroDocumentClass();
  if (typeof MacroClass?.create !== "function") {
    throw new Error("La classe de document Macro de Foundry est introuvable.");
  }
  return MacroClass.create(data);
}
