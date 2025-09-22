def RunScript(person: object = None):
    """Generate a complete profile from person object"""

    # Build profile
    profile = {
        "id": person.id,
        "name": person.name,
        "age": person.age,
        "location": person.city,
        "skills": getattr(person, 'skills', []),
        "level": getattr(person, 'level', 'Unknown')
    }

    return {
        "profile": profile,
        "person_object": person,
        "status": "Profile generated successfully"
    }