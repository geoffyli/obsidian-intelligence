import type { MetadataCondition } from "./types";

/**
 * Calculates a date range based on a meadata field and metadata condition.
 * @param dateCondition - A string like "today", "yesterday", "last_7_days", etc.
 * @returns An object with startDate and endDate as Date objects, or null if condition is invalid.
 */
export function getDateRangeForQuery(metadataCondition: MetadataCondition, dateValue: string): { startDate: Date; endDate: Date } | null {
    const startDate = new Date(dateValue);
    const endDate = new Date(dateValue);

    switch (metadataCondition) {
        case "is":
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
        // case ">":
        //     startDate.setDate(now.getDate() - 1);
        //     startDate.setHours(0, 0, 0, 0);
        //     endDate.setDate(now.getDate() - 1);
        //     endDate.setHours(23, 59, 59, 999);
        //     break;
        // case "last_7_days":
        //     startDate.setDate(now.getDate() - 6); // Includes today, so 6 days back + today = 7 days
        //     startDate.setHours(0, 0, 0, 0);
        //     endDate.setHours(23, 59, 59, 999); // End of today
        //     break;
        // case "this_week":
        //     // Assuming week starts on Sunday
        //     const dayOfWeek = now.getDay(); // 0 (Sun) to 6 (Sat)
        //     startDate.setDate(now.getDate() - dayOfWeek);
        //     startDate.setHours(0, 0, 0, 0);
        //     // End of this week (Saturday)
        //     endDate.setDate(startDate.getDate() + 6);
        //     endDate.setHours(23, 59, 59, 999);
        //     break;
        default:
            console.warn(`Unknown date condition: ${metadataCondition}`);
            return null;
    }
    return { startDate, endDate };
}
