import pytest

from tests.api_data import buat_analytics_db, buat_client


@pytest.fixture(scope="session")
def analytics_db(tmp_path_factory):
    path = tmp_path_factory.mktemp("analytics") / "chibirex.duckdb"
    buat_analytics_db(path)
    return path


@pytest.fixture
def client(analytics_db, tmp_path):
    with buat_client(analytics_db, tmp_path) as c:
        yield c
