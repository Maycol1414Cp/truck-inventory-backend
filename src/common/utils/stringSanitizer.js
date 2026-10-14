/**
 * Sanitiza un código OEM o número de parte removiendo espacios, guiones y caracteres no alfanuméricos.
 * 
 * @param {string|number} code - Código original (ej: "472 500-007 2")
 * @returns {string} - Código limpio en mayúsculas (ej: "4725000072")
 */
export const cleanOemCode = (code) => {
  if (!code) return '';
  return code.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};
