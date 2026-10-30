/**
 * Converts a numerical amount into Indian numbering system words (Lakhs, Crores, Thousands).
 * Example: 531000 -> "INR Five Lakh Thirty One Thousand Only"
 * Example: 81000.50 -> "INR Eighty One Thousand and Paise Fifty Only"
 */

const UNITS = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function convertBelowThousand(n) {
  let str = '';
  if (n >= 100) {
    str += UNITS[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + UNITS[n % 10] : '');
  } else if (n > 0) {
    str += UNITS[n];
  }
  return str.trim();
}

export function numberToIndianWords(amount) {
  const num = Number(amount);
  if (isNaN(num) || num === 0) return 'INR Zero Only';

  const parts = Math.abs(num).toFixed(2).split('.');
  let rupees = parseInt(parts[0], 10);
  const paise = parseInt(parts[1], 10);

  let words = '';

  // Crores (>= 1,00,00,000)
  if (rupees >= 10000000) {
    const crores = Math.floor(rupees / 10000000);
    words += convertBelowThousand(crores) + ' Crore ';
    rupees %= 10000000;
  }

  // Lakhs (>= 1,00,000)
  if (rupees >= 100000) {
    const lakhs = Math.floor(rupees / 100000);
    words += convertBelowThousand(lakhs) + ' Lakh ';
    rupees %= 100000;
  }

  // Thousands (>= 1,000)
  if (rupees >= 1000) {
    const thousands = Math.floor(rupees / 1000);
    words += convertBelowThousand(thousands) + ' Thousand ';
    rupees %= 1000;
  }

  // Hundreds & Below
  if (rupees > 0) {
    words += convertBelowThousand(rupees);
  }

  words = words.trim();

  let result = `INR ${words}`;
  if (paise > 0) {
    const paiseWords = convertBelowThousand(paise);
    result += ` and Paise ${paiseWords}`;
  }

  return `${result} Only`;
}

export default numberToIndianWords;

