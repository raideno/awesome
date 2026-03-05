import fs from 'node:fs'
import * as z from 'zod/v4'

import { AwesomeListSchema } from 'shared/types/list'

const schema = z.toJSONSchema(AwesomeListSchema)

fs.writeFileSync('awesome.list.schema.json', JSON.stringify(schema, null, 2))
