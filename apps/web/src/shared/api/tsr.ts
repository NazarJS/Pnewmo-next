


import {contract} from "@pnewmo/api-contract";
import {initTsrReactQuery} from "@ts-rest/react-query/v5"


export const tsr = initTsrReactQuery(contract, {
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
})