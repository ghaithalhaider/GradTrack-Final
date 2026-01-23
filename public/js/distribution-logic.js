/**
 * distribution-logic.js
 * Implementation of GPA-Priority Stable Project Allocation Algorithm (GPSPA)
 * 
 * Algorithm Logic:
 * 1. Sort all groups Descending order by maxGPA.
 * 2. Iterate through sorted groups.
 * 3. For each group:
 *    - Check preferences in order (1st -> 2nd -> 3rd).
 *    - Assign first available project.
 *    - Stop once assigned.
 * 4. Ensure NO reassignment (Locked upon assignment).
 */

export function runDistributionAlgorithm(teamsData, studentsData) {
    console.log("🚀 Starting GPSPA Algorithm...");

    // ============ STEP 0: Prepare Data Helpers ============

    const studentsMap = {};
    if (Array.isArray(studentsData)) {
        studentsData.forEach(s => studentsMap[s.id] = s);
    } else {
        Object.assign(studentsMap, studentsData);
    }

    // Helper: Calculate Max GPA for a team
    const calculateMaxGPA = (team) => {
        let maxGPA = 0;
        const memberUIDs = team.memberUIDs || [];

        if (memberUIDs.length === 0 && team.id) {
            // Fallback: search by teamCode
            Object.values(studentsMap).forEach(student => {
                if (student.teamCode === team.id) {
                    const gpa = parseFloat(student.gpa || 0);
                    if (gpa > maxGPA) maxGPA = gpa;
                }
            });
        } else {
            memberUIDs.forEach(uid => {
                const student = studentsMap[uid];
                if (student) {
                    const gpa = parseFloat(student.gpa || 0);
                    if (gpa > maxGPA) maxGPA = gpa;
                }
            });
        }
        return maxGPA;
    };

    // Prepare Teams
    // Filter out teams with NO selections? SOP doesn't specify avoiding them, 
    // but they can't be assigned if they have no preferences.
    // We will process them but they just won't get matched.
    let teams = teamsData
        .filter(team => team.selectedProjects && team.selectedProjects.length > 0)
        .map(team => ({
            id: team.id,
            name: team.name || team.id,
            maxGPA: calculateMaxGPA(team),
            choices: [...(team.selectedProjects || [])],
            assignedProjectId: null,
            assignedChoiceRank: null
        }));

    // ============ STEP 1: Sort Groups ============
    // Descending order by maxGPA
    teams.sort((a, b) => b.maxGPA - a.maxGPA);

    console.log(`📊 Sorted ${teams.length} teams by Max GPA.`);

    // ============ STEP 2: Assignment Loop (Greedy) ============
    const assignedProjectIds = new Set();
    const finalAssignments = [];

    // Iterate through each group (Highest GPA first)
    for (const team of teams) {

        // Iterate through preferences
        for (let i = 0; i < team.choices.length; i++) {
            const projectId = team.choices[i];

            // Conflict Handling: If project is NOT already assigned
            if (!assignedProjectIds.has(projectId)) {
                // Assign
                team.assignedProjectId = projectId;
                team.assignedChoiceRank = i + 1;

                assignedProjectIds.add(projectId);

                finalAssignments.push({
                    teamId: team.id,
                    projectId: projectId,
                    maxGPA: team.maxGPA,
                    choiceRank: i + 1
                });

                // Stop checking further preferences
                break;
            }
            // If assigned, loop continues to next preference (Lower GPA adapts)
        }
    }

    // ============ STEP 3: Return Results ============
    console.log(`✅ Assigned ${finalAssignments.length} projects.`);

    // Sanity Check for Duplicates (Should be impossible by logic, but good for reporting)
    const projectCounts = new Map();
    finalAssignments.forEach(a => {
        projectCounts.set(a.projectId, (projectCounts.get(a.projectId) || 0) + 1);
    });

    const duplicateProjects = Array.from(projectCounts.entries())
        .filter(([_, count]) => count > 1)
        .map(([id]) => id);

    return {
        assignments: finalAssignments,
        statistics: {
            totalTeams: teams.length,
            assignedCount: finalAssignments.length,
            unassignedCount: teams.length - finalAssignments.length,
            duplicateProjects: duplicateProjects
        }
    };
}
