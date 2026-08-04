/**
 * Utilitário de Validação de CPF com o algoritmo matemático oficial dos dígitos verificadores (Módulo 11).
 */

function isValidCPF(cpfInput) {
  if (!cpfInput) return false;

  // Remove caracteres não numéricos
  const cleanCPF = String(cpfInput).replace(/\D/g, '');

  // O CPF deve conter exatamente 11 dígitos
  if (cleanCPF.length !== 11) return false;

  // Rejeita sequências de dígitos repetidos conhecidas (ex: 00000000000, 11111111111, etc.)
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  // Cálculo do Primeiro Dígito Verificador (DV1)
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  let dv1 = (rev === 10 || rev === 11) ? 0 : rev;

  if (dv1 !== parseInt(cleanCPF.charAt(9), 10)) return false;

  // Cálculo do Segundo Dígito Verificador (DV2)
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  let dv2 = (rev === 10 || rev === 11) ? 0 : rev;

  if (dv2 !== parseInt(cleanCPF.charAt(10), 10)) return false;

  return true;
}

/**
 * Formata um CPF numérico para a máscara padrão 000.000.000-00
 */
function formatCPF(cpfInput) {
  const clean = String(cpfInput || '').replace(/\D/g, '');
  if (clean.length !== 11) return cpfInput;
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

module.exports = {
  isValidCPF,
  formatCPF
};
