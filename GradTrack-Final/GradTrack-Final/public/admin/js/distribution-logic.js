/**
 * distribution-logic.js
 * GPA-Priority Stable Project Allocation Algorithm (GPSPA)
 * 
 * خوارزمية التوزيع بناءً على:
 * 1. أعلى معدل في الفريق (Max GPA)
 * 2. ترتيب الاختيارات (Preference Priority)
 * 3. لا يُسمح بإعادة التخصيص (Stable Assignment)
 * 4. عند التساوي في المعدل: الأولوية للأقدم تسجيلاً (createdAt)
 */

export function runDistributionAlgorithm(teamsData, studentsData) {
    console.log("🚀 Starting GPSPA Algorithm...");

    // ============ STEP 1: إعداد البيانات ============

    // بناء خريطة الطلاب للوصول السريع O(1)
    const studentsMap = {};
    if (Array.isArray(studentsData)) {
        studentsData.forEach(s => studentsMap[s.id] = s);
    } else {
        Object.assign(studentsMap, studentsData);
    }

    // دالة حساب أعلى معدل في الفريق
    const calculateMaxGPA = (team) => {
        let maxGPA = 0;
        const memberUIDs = team.memberUIDs || [];

        // خطة احتياطية: البحث بواسطة teamCode
        if (memberUIDs.length === 0 && team.id) {
            Object.values(studentsMap).forEach(student => {
                if (student.teamCode === team.id) {
                    const gpa = parseFloat(student.gpa || 0);
                    if (gpa > maxGPA) maxGPA = gpa;
                }
            });
        } else {
            // الطريقة الأساسية: استخدام memberUIDs
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

    // تحضير قائمة الفرق
    let teams = teamsData
        .filter(team => team.selectedProjects && team.selectedProjects.length > 0)
        .map(team => ({
            id: team.id,
            name: team.name || team.id,
            maxGPA: calculateMaxGPA(team),
            createdAt: team.createdAt ? new Date(team.createdAt) : new Date(), // Ensure Date object
            choices: [...(team.selectedProjects || [])],
            assignedProjectId: null,
            assignedChoiceRank: null
        }));

    console.log(`📊 Total teams: ${teams.length}`);

    // ============ STEP 2: الترتيب حسب المعدل (تنازلياً) ثم الأقدمية ============
    // "Sort all groups in Descending order by maxGPA. Tie-breaker: createdAt Ascending (Oldest First)"
    teams.sort((a, b) => {
        const diffGPA = b.maxGPA - a.maxGPA;
        if (diffGPA !== 0) return diffGPA;
        // If GPA is equal, compare timestamps (earlier date = smaller value)
        return a.createdAt - b.createdAt;
    });

    console.log("✅ Teams sorted by Max GPA (highest first) -> CreatedAt (oldest first)");

    // ============ STEP 3: التخصيص (Greedy Allocation) ============
    // "For each group (highest GPA first): Assign the first available project"

    const assignedProjects = new Set();
    const assignments = [];

    for (const team of teams) {
        let projectAssigned = false;

        // المرور على الاختيارات بالترتيب
        for (let i = 0; i < team.choices.length; i++) {
            const projectId = team.choices[i];

            // التحقق: هل المشروع متاح؟
            if (!assignedProjects.has(projectId)) {
                // ✅ المشروع متاح - قم بالتخصيص
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
                projectAssigned = true;
                break; // توقف عن البحث - تم التخصيص
            }
        }

        // إذا لم يحصل الفريق على أي مشروع
        if (!projectAssigned) {
            console.warn(`⚠️ Team ${team.name} (GPA: ${team.maxGPA}) could not be assigned (all choices taken)`);
        }
    }

    // ============ STEP 4: التحقق من النتائج ============

    // فحص التكرارات (يجب أن يكون صفر)
    const projectCounts = {};
    assignments.forEach(a => {
        projectCounts[a.projectId] = (projectCounts[a.projectId] || 0) + 1;
    });

    const duplicateProjects = Object.keys(projectCounts).filter(id => projectCounts[id] > 1);

    if (duplicateProjects.length > 0) {
        console.error("🚨 CRITICAL ERROR: Duplicate projects detected!", duplicateProjects);
    } else {
        console.log("✅ No duplicate projects - Algorithm is correct!");
    }

    // ============ STEP 5: إرجاع النتائج ============
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
