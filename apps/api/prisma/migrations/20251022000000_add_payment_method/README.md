## Migration: add payment method to expense items

- create `PaymentMethod` enum (`CORPORATE_CARD`, `PERSONAL_CARD`, `CASH`, `OTHER`)
- add `paymentMethod` column to `ExpenseItem` with default `OTHER`
