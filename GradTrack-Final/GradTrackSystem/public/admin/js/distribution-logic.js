/**
 * distribution-logic.js
 * GPA-Priority Stable Project Allocation Algorithm (GPSPA)
 * 
 * Based on SOP:
 * 1. Sort all groups by Max GPA (Descending).
 * 2. Iterate highest to lowest.
 * 3. Assign first available preference.
 * 4. No displacement allowed (Highest GPA locks the project).
 */

export function runDistributionAlgorithm(teamsData, studentsData) {
    console.log("🚀 Starting GPSPA Algorithm...");

    // ============ STEP 1: Data Preparation ============

    // Map students for O(1) access
    const studentsMap = {};
    if (Array.isArray(studentsData)) {
        studentsData.forEach(s => studentsMap[s.id] = s);
    } else {
        Object.assign(studentsMap, studentsData);
    }

    // Helper to calculate Max GPA per team (Highest among members)
    const calculateMaxGPA = (team) => {
        let maxGPA = 0;
        const memberUIDs = team.memberUIDs || [];

        // Fallback: search by teamCode if no UIDs (robustness)
        if (memberUIDs.length === 0 && team.id) {
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

    // Prepare Team Objects
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

    // ============ STEP 2: Sort (Descending Max GPA) ============
    // "Sort all groups Descending order by maxGPA"
    teams.sort((a, b) => b.maxGPA - a.maxGPA);

    console.log(`📊 Teams Sorted. Count: ${teams.length}`);

    // ============ STEP 3: Allocation Loop (Greedy) ============
    // "For each group (highest GPA first): Assign the first available project"

    const assignedProjects = new Set();
    const assignments = [];

    for (const team of teams) {
        // Try preferences in order
        for (let i = 0; i < team.choices.length; i++) {
            const projectId = team.choices[i];

            // Conflict Handling: "If a project is already assigned: The lower-GPA group must try its next preference"
            if (!assignedProjects.has(projectId)) {
                // Success! Assign project
                team.assignedProjectId = projectId;
                team.assignedChoiceRank = i + 1;

                assignedProjects.add(projectId);

                assignments.push({
                    teamId: team.id,
                    projectId: projectId,
                    maxGPA: team.maxGPA,
                    choiceRank: i + 1
                });

                console.log(`✅ Assigned ${projectId} to ${team.name} (GPA: ${team.maxGPA}, Choice: #${i + 1})`);
                break; // Stop checking further preferences as we found one
            } else {
                // "No reassignment is allowed once a higher-GPA group is placed"
                console.log(`🔒 Project ${projectId} busy. ${team.name} (GPA: ${team.maxGPA}) trying next...`);
            }
        }

        if (!team.assignedProjectId) {
            console.warn(`⚠️ Team ${team.name} (GPA: ${team.maxGPA}) could not be assigned any of their choices.`);
        }
    }

    // ============ STEP 4: Results & Validation ============

    // Calculate Duplicates (Should be 0 by definition of Set logic)
    const projectCounts = {};
    assignments.forEach(a => {
        projectCounts[a.projectId] = (projectCounts[a.projectId] || 0) + 1;
    });

    const duplicateProjects = Object.keys(projectCounts).filter(id => projectCounts[id] > 1);

    if (duplicateProjects.length > 0) {
        console.error("🚨 CRITICAL: Duplicates found in GPSPA result!", duplicateProjects);
    }

    return {
        assignments: assignments,
        statistics: {
            totalTeams: teams.length,
            assignedCount: assignments.length,
            unassignedCount: teams.length - assignments.length,
            duplicateProjects: duplicateProjects
        }
    };
}
