from typing import Any

def RunScript(person: Any = None, skills: str = "Python, JavaScript, SQL"):
    """Add skills to the person object"""
    
    # Check if person is None
    if person is None:
        return {"error": "Person is None"}
    
    # Parse skills
    skill_list = [s.strip() for s in skills.split(",")]

    # Add skills to person
    try:
        person.skills = skill_list
        person.skill_level = len(skill_list)
    except AttributeError as e:
        return {"error": f"AttributeError: {e}"}

    # Determine level
    if person.skill_level >= 5:
        person.level = "Expert"
    elif person.skill_level >= 3:
        person.level = "Intermediate"
    else:
        person.level = "Beginner"

    return {
        "person": person,
        "summary": f"{person.name} knows {len(skill_list)} skills: {', '.join(skill_list)}"
    }
