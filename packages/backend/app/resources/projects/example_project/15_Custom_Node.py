from typing import Any

class Person:
    def __init__(self, name, age, city):
        self.name = name
        self.age = age
        self.city = city
        self.id = f"user_{name.lower().replace(' ', '_')}"

def RunScript(start: Any = None, name: str = "John Doe", age: str = "25", city: str = "Seoul"):
    """Create a Person object"""

    person = Person(name, int(age), city)

    return {
        "person": person,
        "info": f"Created person: {person.name}, {person.age} years old from {person.city}"
    }