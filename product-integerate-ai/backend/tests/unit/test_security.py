from datetime import timedelta
from uuid import uuid4

import pytest

from app.core import security
from app.core.errors import AuthError

SECRET = "s" * 40


def test_password_hash_roundtrip():
    h = security.hash_password("Correct-Horse-9")
    assert h != "Correct-Horse-9"
    assert security.verify_password("Correct-Horse-9", h)
    assert not security.verify_password("wrong", h)


def test_password_policy():
    with pytest.raises(ValueError):
        security.validate_password_strength("short1A")
    with pytest.raises(ValueError):
        security.validate_password_strength("alllowercaseletters")
    security.validate_password_strength("Str0ng-enough-pw")


def test_access_token_roundtrip():
    uid = uuid4()
    tok = security.create_access_token(uid, SECRET, timedelta(minutes=5))
    claims = security.decode_token(tok, SECRET, expected_type="access")
    assert claims["sub"] == str(uid)


def test_expired_token_rejected():
    tok = security.create_access_token(uuid4(), SECRET, timedelta(seconds=-1))
    with pytest.raises(AuthError):
        security.decode_token(tok, SECRET, expected_type="access")


def test_wrong_secret_rejected():
    tok = security.create_access_token(uuid4(), SECRET, timedelta(minutes=5))
    with pytest.raises(AuthError):
        security.decode_token(tok, "o" * 40, expected_type="access")


def test_refresh_token_not_accepted_as_access():
    tok, _jti = security.create_refresh_token(uuid4(), uuid4(), SECRET, timedelta(days=1))
    with pytest.raises(AuthError):
        security.decode_token(tok, SECRET, expected_type="access")


def test_token_digest_is_stable_and_not_plaintext():
    assert security.token_digest("abc") == security.token_digest("abc")
    assert "abc" not in security.token_digest("abc")
