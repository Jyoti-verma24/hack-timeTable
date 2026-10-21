# Scheduling Optimizer

A web app that generates clash-free college timetables for any college.

## Stack

Plain HTML/CSS/JS, no build step and no backend. Deployed as static files. The solver runs in the browser.

## Core principle: no college is hard-coded

Everything specific to a college (days, periods, timings, lunch, rooms, teachers, sections, teaching load) is input data, never code. Sample colleges exist only as demo data.

## Data model

1. College settings: working days, periods per day, period timings, lunch position, half-days
2. Departments: code, name
3. Rooms: name, type (classroom / lab / hall), capacity, owner department or shared
4. Teachers: name, department, max hours per week and per day, unavailable slots
5. Sections: name, department, semester, number of students
6. Teaching load: section, subject, teacher, type (theory / lab), hours per week, block length, room type

## Rules

Hard (must never break): no teacher, room or section in two places at once; room fits the class; labs only in lab rooms; teacher unavailability respected; lab periods consecutive and not across lunch; every required hour scheduled.

Soft (scored): max 3 classes in a row per teacher, few gaps for students, subjects spread across the week, balanced daily load, teacher preferences, fair use of shared rooms.

## Working style

Commit small working steps to Git. The app must still open and run after every commit.
