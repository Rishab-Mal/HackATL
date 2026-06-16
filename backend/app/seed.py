"""Reference data the app needs to function: portal logins and the catalog of
buyers (recyclers and makers) that lots can be claimed by.

There is intentionally NO sample inventory here. Every lot is created from a
real camera scan, so the marketplace and all admin metrics start empty and
fill in live as the demo runs. This keeps the numbers credible for judges.

Idempotent: if the users table is already populated (e.g. seeded directly in
Supabase) this is a no-op.
"""

import hashlib

from sqlalchemy.orm import Session

from . import models


def _hash(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def seed_data(db: Session) -> None:
    if db.query(models.User).count() > 0:
        return  # already seeded

    db.add_all(
        [
            models.User(email="factory@demo.com", password_hash=_hash("factory123"), role="factory", name="Factory Worker"),
            models.User(email="admin@demo.com", password_hash=_hash("admin123"), role="admin", name="Admin"),
            models.User(email="buyer@demo.com", password_hash=_hash("buyer123"), role="buyer", name="Buyer"),
        ]
    )
    db.add_all(_make_buyers())
    db.commit()


def _make_buyers():
    return [
        models.Buyer(
            name="Looptex Recyclers",
            type="recycler",
            location="Atlanta, GA",
            description=(
                "Mechanical recycler turning cotton-rich offcuts into reclaimed "
                "yarn for industrial wiping cloths and insulation."
            ),
            interested_materials="cotton,denim,twill,canvas",
        ),
        models.Buyer(
            name="Thread & Tide Studio",
            type="maker",
            location="Decatur, GA",
            description=(
                "Small-batch accessories maker sourcing colorful jersey scraps "
                "for scrunchies, bags, and quilted patchwork goods."
            ),
            interested_materials="cotton,jersey,spandex,knit",
        ),
        models.Buyer(
            name="Carter's Circular Supply Pilot",
            type="recycler",
            location="Atlanta, GA",
            description=(
                "Supplier sustainability pilot evaluating reclaimed cotton "
                "blends for future packaging inserts and fill material."
            ),
            interested_materials="cotton,spandex,jersey,twill,denim,fleece",
        ),
        models.Buyer(
            name="Re:Loom Fiber Co.",
            type="recycler",
            location="Chattanooga, TN",
            description=(
                "Fiber recycler shredding polyester and fleece blends back into "
                "raw fill for furniture and outdoor gear."
            ),
            interested_materials="polyester,fleece,terry,blend",
        ),
        models.Buyer(
            name="Stitch & Story Makers",
            type="maker",
            location="Asheville, NC",
            description=(
                "Maker collective turning linen and modal offcuts into "
                "limited-run tote bags and apparel trims."
            ),
            interested_materials="cotton,linen,modal,canvas",
        ),
        models.Buyer(
            name="Southern Quilt Collective",
            type="maker",
            location="Macon, GA",
            description=(
                "Volunteer quilting group sourcing cotton scraps of all colors "
                "for community quilts and donation projects."
            ),
            interested_materials="cotton,jersey,poplin,knit",
        ),
        models.Buyer(
            name="EcoFill Industries",
            type="recycler",
            location="Birmingham, AL",
            description=(
                "Industrial recycler converting mixed cotton/poly scraps into "
                "acoustic and thermal insulation panels."
            ),
            interested_materials="cotton,polyester,fleece,denim",
        ),
        models.Buyer(
            name="Bolt & Seam Studio",
            type="maker",
            location="Athens, GA",
            description=(
                "Independent designer using stretch knits and terry scraps for "
                "activewear sample runs."
            ),
            interested_materials="cotton,spandex,knit,terry",
        ),
    ]
