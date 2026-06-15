export function formatMoney(value, options = {}) {
  const amount = Number(value) || 0
  const { compactCents = true, maximumFractionDigits = 2 } = options
  if (amount === 0) return '$0'
  if (compactCents && Math.abs(amount) < 1) {
    const cents = amount * 100
    if (Math.abs(cents) < 1) return '<1¢'
    return `${formatNumber(cents, cents < 10 ? 1 : 0)}¢`
  }
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: amount < 10 ? 2 : 0,
    maximumFractionDigits,
  })}`
}

export function formatUnitPrice(value, unit = 'kg') {
  const amount = Number(value) || 0
  if (amount === 0) return `$0 / ${unit}`
  return `${formatMoney(amount, { compactCents: false, maximumFractionDigits: amount < 10 ? 2 : 1 })} / ${unit}`
}

export function formatWeightKg(value) {
  const kg = Number(value) || 0
  if (kg <= 0) return '0 g'
  if (kg >= 1) return `${formatNumber(kg, kg >= 10 ? 1 : 2)} kg`
  const grams = kg * 1000
  if (grams >= 1) return `${formatNumber(grams, grams < 10 ? 1 : 0)} g`
  return `${formatNumber(grams * 1000, 0)} mg`
}

export function formatInputKg(value) {
  const kg = Number(value) || 0
  if (kg <= 0) return '0'
  if (kg < 0.01) return trimNumber(kg, 4)
  if (kg < 1) return trimNumber(kg, 3)
  return trimNumber(kg, 2)
}

export function lotQuantityStep(weightKg) {
  const weight = Number(weightKg) || 0
  if (weight <= 0) return 0.001
  if (weight <= 0.02) return 0.001
  if (weight <= 0.1) return 0.005
  if (weight < 1) return 0.025
  return 0.1
}

function formatNumber(value, maximumFractionDigits) {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })
}

function trimNumber(value, maximumFractionDigits) {
  return Number(value).toFixed(maximumFractionDigits).replace(/\.?0+$/, '')
}
