import 'dotenv/config'
import { env } from './env/server'

import {  users } from '@/data/placeholder-data'
import {db} from '@/drizzle/db'
import * as schema from '../drizzle/schema'
import { exit } from 'process'
const main = async () => {
  try {
    await db.transaction(async (tx) => {
      // await tx.delete(schema.revenue)
      // await tx.delete(schema.programs)
      // await tx.delete(schema.customers)
      await tx.delete(schema.user)
      await tx.insert(schema.user).values(users)
      // await tx.insert(schema.customers).values(customers)
      // await tx.insert(schema.programs).values(programs)
      // await tx.insert(schema.revenue).values(revenue)
    })
    console.log('Database seeded successfully')
    exit(0)
  } catch (error) {
    console.error(error)
    throw new Error('Failed to seed database')
  }
}
main()