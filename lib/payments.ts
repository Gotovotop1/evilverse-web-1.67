import { checkMonoPayments, monoStatus } from "@/lib/mono"
import { checkTonPayments, tonStatus } from "@/lib/ton"
import { checkTronPayments, tronStatus } from "@/lib/tron"

/** Перевірити всі автоматичні способи оплати (кожен сам обмежує частоту запитів). */
export async function checkPayments() {
  await Promise.all([checkMonoPayments(), checkTonPayments(), checkTronPayments()])
}

export async function paymentsStatus() {
  const [mono, ton, tron] = await Promise.all([monoStatus(), tonStatus(), tronStatus()])
  return { mono, ton, tron }
}
