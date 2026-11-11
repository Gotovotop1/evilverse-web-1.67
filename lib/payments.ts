import { pool } from "@/lib/db"
import { ensureDeliveryColumns } from "@/lib/db/ensure"
import { takeSlot } from "@/lib/kv"
import { checkMonoPayments, monoStatus } from "@/lib/mono"
import { checkTonPayments, tonStatus } from "@/lib/ton"
import { checkTronPayments, tronStatus } from "@/lib/tron"
import { checkDonatepayPayments, donatepayStatus } from "@/lib/donatepay"
import { starsStatus } from "@/lib/stars"

/** Перевірити всі автоматичні способи оплати (кожен сам обмежує частоту запитів). */
export async function checkPayments() {
  await Promise.all([checkMonoPayments(), checkTonPayments(), checkTronPayments(), checkDonatepayPayments(), cancelStale()])
}

/** Неоплачені замовлення старші за 7 днів — скасовуються (раз на годину на всі копії сайту). */
async function cancelStale() {
  try {
    await ensureDeliveryColumns()
    if (!(await takeSlot("stale_cancel", 3600_000))) return
    await pool.query(
      `UPDATE orders SET status = 'cancelled', payment_log = COALESCE(payment_log, '[]'::jsonb) || '["скасовано автоматично: не оплачено 7 днів"]'::jsonb
       WHERE status = 'pending' AND created_at < now() - interval '7 days'`,
    )
    await pool.query("DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'")
  } catch (error) {
    console.error("[stale-cancel]", error)
  }
}

export async function paymentsStatus() {
  const [mono, ton, tron, donatepay, stars] = await Promise.all([monoStatus(), tonStatus(), tronStatus(), donatepayStatus(), starsStatus()])
  return { mono, ton, tron, donatepay, stars }
}
